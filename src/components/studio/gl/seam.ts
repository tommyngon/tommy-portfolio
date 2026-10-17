// Raw WebGL2 renderer for the "seam bend" image column. Own code.
export type SeamEntry = { el: HTMLImageElement; wrap: HTMLElement };

const GRID = 32;

const VERT = `#version 300 es
in vec2 a_uv;
uniform vec4 u_rect;   // left, top, width, height (css px)
uniform vec2 u_vp;     // viewport css px
uniform float u_amt;   // signed bend, -1..1
out vec2 v_uv;
void main() {
  vec2 p = u_rect.xy + a_uv * u_rect.zw;
  float seam = 1.0 - abs(a_uv.x * 2.0 - 1.0);       // 1 at the centre seam
  float fold = seam * seam * (3.0 - 2.0 * seam);
  float ripple = 0.75 + 0.25 * cos(a_uv.y * 3.14159 * 2.0 + p.y / u_vp.y * 3.0);
  float z = u_amt * fold * ripple * 150.0;           // cloth folds along the seam
  float cy = (p.y / u_vp.y) * 2.0 - 1.0;
  z -= abs(u_amt) * cy * cy * 90.0;                  // barrel at top/bottom
  float k = 1400.0 / (1400.0 - z);
  vec2 c = u_vp * 0.5;
  p = c + (p - c) * k;
  vec2 ndc = p / u_vp * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  v_uv = a_uv;
}`;

const FRAG = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_fade;
out vec4 o;
void main() {
  vec3 c = texture(u_tex, v_uv).rgb;
  o = vec4(c * u_fade, u_fade);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
  return s;
}

type Slot = {
  entry: SeamEntry;
  tex: WebGLTexture | null;
  wanted: boolean;
  readyAt: number;
  onLoad?: () => void;
};

export class SeamRenderer {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private prog: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private buffers: WebGLBuffer[] = [];
  private count: number;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private slots: Slot[] = [];
  private io: IntersectionObserver;
  private raf = 0;
  private lastY = 0;
  private lastT = 0;
  private amt = 0;
  private vel = 0;
  private dpr = 1;
  private disposed = false;

  static create(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) return null;
    try {
      return new SeamRenderer(canvas, gl);
    } catch {
      return null;
    }
  }

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.canvas = canvas;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(prog, 0, "a_uv");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
    this.prog = prog;
    for (const n of ["u_rect", "u_vp", "u_amt", "u_tex", "u_fade"]) this.loc[n] = gl.getUniformLocation(prog, n);

    const n = GRID + 1;
    const uv = new Float32Array(n * n * 2);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        uv[(y * n + x) * 2] = x / GRID;
        uv[(y * n + x) * 2 + 1] = y / GRID;
      }
    const idx = new Uint16Array(GRID * GRID * 6);
    let o = 0;
    for (let y = 0; y < GRID; y++)
      for (let x = 0; x < GRID; x++) {
        const a = y * n + x, b = a + 1, c = a + n, d = c + 1;
        idx.set([a, c, b, b, c, d], o);
        o += 6;
      }
    this.count = idx.length;
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const vb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.buffers.push(vb, ib);

    this.io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (!e.isIntersecting) continue;
          const s = this.slots.find((x) => x.entry.wrap === e.target);
          if (s) this.request(s);
        }
      },
      { rootMargin: "100% 0px 100% 0px" },
    );
    this.resize();
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVis);
    this.lastY = window.scrollY;
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  add(entry: SeamEntry) {
    // Hide the DOM image from the start; the canvas fades it in when its texture is ready.
    entry.el.style.opacity = "0";
    this.slots.push({ entry, tex: null, wanted: false, readyAt: 0 });
    this.io.observe(entry.wrap);
  }

  private request(s: Slot) {
    if (s.wanted) return;
    s.wanted = true;
    const el = s.entry.el;
    const upload = () => {
      if (this.disposed || !el.naturalWidth) return;
      const gl = this.gl;
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
      } catch {
        gl.deleteTexture(t);
        el.style.opacity = "";
        return;
      }
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      s.tex = t;
      s.readyAt = performance.now();
    };
    if (el.complete && el.naturalWidth) upload();
    else {
      s.onLoad = upload;
      el.addEventListener("load", upload, { once: true });
      el.loading = "eager";
    }
  }

  private onVis = () => {
    if (document.hidden) cancelAnimationFrame(this.raf);
    else if (!this.disposed) {
      this.lastT = performance.now();
      this.lastY = window.scrollY;
      this.raf = requestAnimationFrame(this.frame);
    }
  };

  private resize = () => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(window.innerWidth * this.dpr);
    this.canvas.height = Math.round(window.innerHeight * this.dpr);
  };

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min((now - this.lastT) / 1000, 0.05) || 0.016;
    this.lastT = now;
    const y = window.scrollY;
    const target = Math.max(-1, Math.min(1, (y - this.lastY) / dt / 3000));
    this.lastY = y;
    // Damped spring (about 400 ms to settle) toward the scroll-velocity target.
    const k = 150, c = 2 * Math.sqrt(k) * 0.9;
    this.vel += ((target - this.amt) * k - this.vel * c) * dt;
    this.amt += this.vel * dt;
    if (Math.abs(this.amt) < 0.0005 && Math.abs(this.vel) < 0.001 && target === 0) {
      this.amt = 0;
      this.vel = 0;
    }

    const gl = this.gl;
    const vw = window.innerWidth, vh = window.innerHeight;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(this.loc.u_vp, vw, vh);
    gl.uniform1f(this.loc.u_amt, this.amt);
    gl.uniform1i(this.loc.u_tex, 0);
    gl.activeTexture(gl.TEXTURE0);
    for (const s of this.slots) {
      if (!s.tex) continue;
      const r = s.entry.el.getBoundingClientRect();
      if (r.bottom < -vh * 0.2 || r.top > vh * 1.2 || r.width < 1) continue;
      const t = Math.min(1, (now - s.readyAt) / 700);
      const fade = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // ease in-out cubic, ~var(--ease)
      gl.bindTexture(gl.TEXTURE_2D, s.tex);
      gl.uniform4f(this.loc.u_rect, r.left, r.top, r.width, r.height);
      gl.uniform1f(this.loc.u_fade, fade);
      gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.onVis);
    this.io.disconnect();
    const gl = this.gl;
    for (const s of this.slots) {
      if (s.onLoad) s.entry.el.removeEventListener("load", s.onLoad);
      if (s.tex) gl.deleteTexture(s.tex);
      s.entry.el.style.opacity = "";
    }
    this.slots = [];
    for (const b of this.buffers) gl.deleteBuffer(b);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.prog);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
