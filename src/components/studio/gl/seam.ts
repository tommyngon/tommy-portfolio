// Raw WebGL2 renderer for the "seam bend" image column. Own code.
// A live source (e.g. the QBIKK orb) draws itself into its own canvas; the column re-uploads
// that canvas every frame while the sheet is on screen. `el` stays as the static fallback.
export type LiveSource = { canvas: HTMLCanvasElement; render(timeSec: number): void; dispose(): void };
export type SeamEntry = { el: HTMLImageElement; wrap: HTMLElement; live?: LiveSource };

const GRID = 32;

const VERT = `#version 300 es
in vec2 a_uv;
uniform vec4 u_rect;   // left, top, width, height (css px)
uniform vec2 u_vp;     // viewport css px
uniform float u_amt;   // signed scroll velocity, -1..1 (smoothed)
uniform vec4 u_crop;   // uv scale (xy) and offset (zw) for object-fit: cover
uniform float u_seed;  // per-image phase, so no two sheets bend alike
uniform float u_time;  // seconds
uniform float u_lift;  // 0..1 hover, the sheet swells a touch towards the viewer
out vec2 v_uv;
out float v_roll;    // 1 while the sheet is still facing us, 0 once rolled over the drum
void main() {
  vec2 p = u_rect.xy + (a_uv - 0.5) * u_rect.zw * (1.0 + 0.015 * u_lift) + u_rect.zw * 0.5;
  float energy = abs(u_amt);

  // 1. The sheet passes over a drum: above the horizon it rolls away from the viewer
  //    (foreshortened, narrower) and keeps travelling up to the top edge and out of view;
  //    below it leans gently towards the viewer. The curvature is chosen so the top of the
  //    screen still maps to (about) the top of the screen.
  float horizon = u_vp.y * 0.46;
  float t = (p.y - horizon) / u_vp.y;
  float z;
  v_roll = 1.0;
  if (t < 0.0) {
    float k = 1.1 + 0.6 * energy;                   // curvature, rad per viewport height
    float r = u_vp.y / k;
    float th = max(t * k, -1.5);
    v_roll = 1.0 - smoothstep(1.4, 1.55, -t * k); // only once it is past the top edge
    p.y = horizon + r * sin(th);
    z = -r * (1.0 - cos(th));
  } else {
    z = t * t * u_vp.y * (0.35 + 0.5 * energy);
  }

  // 2. The long edges ripple like paper: a slow S-curve, stronger while moving.
  float side = a_uv.x * 2.0 - 1.0;                  // -1 left edge, +1 right edge
  float edge = side * side * side;
  float wob = sin(a_uv.y * 3.6 + u_seed * 6.283 + u_time * 0.35)
            + 0.45 * sin(a_uv.y * 7.1 - u_seed * 3.1);
  p.x += edge * wob * (0.04 + 0.07 * energy) * u_rect.z * (0.6 + 0.4 * sign(side) * sin(u_seed * 12.0));
  // the short edges tilt a touch
  p.y += (a_uv.x - 0.5) * sin(u_seed * 9.0) * (6.0 + 22.0 * energy) * mix(1.0, -0.6, a_uv.y);

  // 3. Perspective about the viewport's centre column.
  float f = 1600.0 / (1600.0 - z);
  p.x = u_vp.x * 0.5 + (p.x - u_vp.x * 0.5) * f;

  vec2 ndc = p / u_vp * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  v_uv = a_uv * u_crop.xy + u_crop.zw;
}`;

const FRAG = `#version 300 es
precision mediump float;
in vec2 v_uv;
in float v_roll;
uniform sampler2D u_tex;
uniform float u_fade;
out vec4 o;
void main() {
  vec3 c = texture(u_tex, v_uv).rgb;
  float a = u_fade * v_roll;
  o = vec4(c * a, a);
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
  lift: number;
  hover: boolean;
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
    for (const n of ["u_rect", "u_vp", "u_amt", "u_tex", "u_fade", "u_crop", "u_seed", "u_time", "u_lift"]) this.loc[n] = gl.getUniformLocation(prog, n);

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
    this.slots.push({ entry, tex: null, wanted: false, readyAt: 0, lift: 0, hover: false });
    entry.wrap.addEventListener("pointerenter", () => this.setHover(entry, true));
    entry.wrap.addEventListener("pointerleave", () => this.setHover(entry, false));
    this.io.observe(entry.wrap);
  }

  private setHover(entry: SeamEntry, on: boolean) {
    const s = this.slots.find((x) => x.entry === entry);
    if (s) s.hover = on;
  }

  private request(s: Slot) {
    if (s.wanted) return;
    s.wanted = true;
    const el = s.entry.el;
    const live = s.entry.live;
    if (live) {
      const gl = this.gl;
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      live.render(performance.now() / 1000);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, live.canvas);
      s.tex = t;
      s.readyAt = performance.now();
      return;
    }
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
    const target = Math.max(-1, Math.min(1, (y - this.lastY) / dt / 1500));
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
    gl.uniform1f(this.loc.u_time, now / 1000);
    gl.uniform1i(this.loc.u_tex, 0);
    gl.activeTexture(gl.TEXTURE0);
    for (const s of this.slots) {
      if (!s.tex) continue;
      const r = s.entry.el.getBoundingClientRect();
      if (r.bottom < -vh * 0.2 || r.top > vh * 1.2 || r.width < 1) continue;
      const t = Math.min(1, (now - s.readyAt) / 700);
      const fade = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // ease in-out cubic, ~var(--ease)
      gl.bindTexture(gl.TEXTURE_2D, s.tex);
      const live = s.entry.live;
      if (live) {
        live.render(now / 1000);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, live.canvas);
      }
      gl.uniform4f(this.loc.u_rect, r.left, r.top, r.width, r.height);
      // object-fit: cover — crop the longer side of the texture to the box's aspect
      const ia = (live ? live.canvas.width : s.entry.el.naturalWidth) / (live ? live.canvas.height : s.entry.el.naturalHeight), ba = r.width / r.height;
      const sx = ia > ba ? ba / ia : 1, sy = ia > ba ? 1 : ia / ba;
      gl.uniform4f(this.loc.u_crop, sx, sy, (1 - sx) / 2, (1 - sy) / 2);
      s.lift += ((s.hover ? 1 : 0) - s.lift) * Math.min(1, dt * 6);
      gl.uniform1f(this.loc.u_lift, s.lift);
      gl.uniform1f(this.loc.u_fade, fade);
      gl.uniform1f(this.loc.u_seed, ((this.slots.indexOf(s) * 0.618034) % 1));
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
      s.entry.live?.dispose();
      s.entry.el.style.opacity = "";
    }
    this.slots = [];
    for (const b of this.buffers) gl.deleteBuffer(b);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.prog);
    // the context itself stays alive: React may re-attach this same canvas (StrictMode,
    // back/forward), and a lost context would leave the column flat
  }
}
