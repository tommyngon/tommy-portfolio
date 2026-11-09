// Raw WebGL2 renderer for the "seam bend" image column. Own code.
// A live source (e.g. the QBIKK orb) draws itself into its own canvas; the column re-uploads
// that canvas every frame while the sheet is on screen. `el` stays as the static fallback.
// `mark` is a transparent sheet-sized layer (the QBIKK wordmark) laid over a live source in white.
//
// Everything expensive is kept off the frames that matter: images are decoded off the main
// thread (createImageBitmap on the fetched bytes), at most one GPU upload runs per frame,
// and the loop only runs while a sheet is near the viewport. `changed` lets a live source
// say nothing moved, so this frame needs no redraw or re-upload.
export type LiveSource = {
  canvas: HTMLCanvasElement;
  render(timeSec: number): void;
  dispose(): void;
  changed?(timeSec: number): boolean;
};
export type SeamEntry = { el: HTMLImageElement; wrap: HTMLElement; live?: () => LiveSource | null; mark?: string };

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
uniform sampler2D u_mark;
uniform float u_fade;
out vec4 o;
void main() {
  vec3 c = texture(u_tex, v_uv).rgb;
  c = mix(c, vec3(1.0), texture(u_mark, v_uv).a);
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
  source: LiveSource | null;
  tex: WebGLTexture | null;
  markTex: WebGLTexture | null;
  wanted: boolean;
  near: boolean;
  keepDom: boolean; // the sheet was already on screen when it was added: its DOM image stays until the canvas has faded in on top
  readyAt: number;
  lift: number;
  hover: boolean;
  onLoad?: () => void;
};

// Off-main-thread decode. Same bytes the <img> already fetched, so this is a cache hit.
async function decodeBitmap(url: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob(), { premultiplyAlpha: "none", colorSpaceConversion: "default" });
  } catch {
    return null;
  }
}

export class SeamRenderer {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private prog: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private buffers: WebGLBuffer[] = [];
  private noMark: WebGLTexture; // 1x1 transparent, bound for every sheet without a mark
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
  private running = false;
  private drew = false;
  private uploads: (() => void)[] = [];

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
    for (const n of ["u_rect", "u_vp", "u_amt", "u_tex", "u_mark", "u_fade", "u_crop", "u_seed", "u_time", "u_lift"]) this.loc[n] = gl.getUniformLocation(prog, n);

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

    this.noMark = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.noMark);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));

    this.io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          const s = this.slots.find((x) => x.entry.wrap === e.target);
          if (!s) continue;
          s.near = e.isIntersecting;
          if (e.isIntersecting) this.request(s);
        }
        this.updateLoop();
      },
      { rootMargin: "100% 0px 100% 0px" },
    );
    this.resize();
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVis);
    this.lastY = window.scrollY;
    this.lastT = performance.now();
  }

  // The loop and the canvas exist only while a sheet is within a screen of the viewport.
  private updateLoop() {
    const near = !document.hidden && this.slots.some((x) => x.near);
    if (near && !this.running) {
      this.running = true;
      this.canvas.style.display = "block";
      this.lastT = performance.now();
      this.lastY = window.scrollY;
      this.raf = requestAnimationFrame(this.frame);
    } else if (!near && this.running) {
      this.running = false;
      cancelAnimationFrame(this.raf);
      this.canvas.style.display = "none";
    }
  }

  add(entry: SeamEntry) {
    // Off screen, hide the DOM image from the start; the canvas fades it in when its texture
    // is ready. A sheet already in view keeps its DOM image until the canvas has faded in.
    const r = entry.el.getBoundingClientRect();
    const keepDom = r.bottom > 0 && r.top < window.innerHeight;
    if (!keepDom) entry.el.style.opacity = "0";
    this.slots.push({ entry, source: null, tex: null, markTex: null, wanted: false, near: false, keepDom, readyAt: 0, lift: 0, hover: false });
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
    if (s.entry.mark) void this.loadMark(s, s.entry.mark);
    if (s.entry.live) {
      this.uploads.push(() => this.prepareLive(s));
      return;
    }
    this.requestStill(s);
  }

  private requestStill(s: Slot) {
    const el = s.entry.el;
    const begin = () => void this.loadStill(s);
    if (el.complete && el.naturalWidth) begin();
    else {
      s.onLoad = begin;
      el.addEventListener("load", begin, { once: true });
      el.loading = "eager";
    }
  }

  private setTexParams() {
    const gl = this.gl;
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private async loadMark(s: Slot, src: string) {
    const bitmap = await decodeBitmap(src);
    if (this.disposed) {
      bitmap?.close();
      return;
    }
    if (!bitmap) return;
    this.uploads.push(() => {
      const gl = this.gl;
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
      bitmap.close();
      this.setTexParams();
      s.markTex = t;
    });
  }

  private async loadStill(s: Slot) {
    const el = s.entry.el;
    const bitmap = await decodeBitmap(el.currentSrc || el.src);
    if (this.disposed) {
      bitmap?.close();
      return;
    }
    this.uploads.push(() => this.uploadStill(s, bitmap));
  }

  private uploadStill(s: Slot, bitmap: ImageBitmap | null) {
    const gl = this.gl;
    const el = s.entry.el;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap ?? el);
    } catch {
      gl.deleteTexture(t);
      bitmap?.close();
      el.style.opacity = "";
      return;
    }
    bitmap?.close();
    this.setTexParams();
    s.tex = t;
    s.readyAt = performance.now();
  }

  // Created on its own frame, then drawn and uploaded on the next, so the GL context and
  // shader compile of a live source never share a frame with its first upload.
  private prepareLive(s: Slot) {
    const source = s.entry.live?.() ?? null;
    if (!source) {
      this.requestStill(s);
      return;
    }
    s.source = source;
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.uploads.push(() => {
      gl.bindTexture(gl.TEXTURE_2D, t);
      source.render(performance.now() / 1000);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source.canvas);
      s.tex = t;
      s.readyAt = performance.now();
    });
  }

  private onVis = () => {
    if (!this.disposed) this.updateLoop();
  };

  private resize = () => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(window.innerWidth * this.dpr);
    this.canvas.height = Math.round(window.innerHeight * this.dpr);
  };

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    this.uploads.shift()?.(); // at most one upload per frame
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
    // nothing on screen and nothing left over from the last frame: no GL work at all
    const inView = this.slots.map((s) => {
      const r = s.entry.el.getBoundingClientRect();
      return s.tex && !(r.bottom < -vh * 0.2 || r.top > vh * 1.2 || r.width < 1) ? r : null;
    });
    const hasWork = inView.some(Boolean);
    if (!hasWork && !this.drew) return;
    this.drew = hasWork;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!hasWork) return;
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(this.loc.u_vp, vw, vh);
    gl.uniform1f(this.loc.u_amt, this.amt);
    gl.uniform1f(this.loc.u_time, now / 1000);
    gl.uniform1i(this.loc.u_tex, 0);
    gl.uniform1i(this.loc.u_mark, 1);
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      const r = inView[i];
      if (!r || !s.tex) continue;
      const t = Math.min(1, (now - s.readyAt) / 700);
      if (t >= 1 && s.keepDom) {
        s.keepDom = false;
        s.entry.el.style.opacity = "0"; // the canvas has fully covered it
      }
      const fade = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // ease in-out cubic, ~var(--ease)
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, s.markTex ?? this.noMark);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, s.tex);
      const live = s.source;
      if (live && (!live.changed || live.changed(now / 1000))) {
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
      gl.uniform1f(this.loc.u_seed, ((i * 0.618034) % 1));
      gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
    }
  };

  dispose() {
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.canvas.style.display = "none";
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.onVis);
    this.io.disconnect();
    const gl = this.gl;
    for (const s of this.slots) {
      if (s.onLoad) s.entry.el.removeEventListener("load", s.onLoad);
      if (s.tex) gl.deleteTexture(s.tex);
      if (s.markTex) gl.deleteTexture(s.markTex);
      s.source?.dispose();
      s.entry.el.style.opacity = "";
    }
    this.slots = [];
    for (const b of this.buffers) gl.deleteBuffer(b);
    gl.deleteTexture(this.noMark);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.prog);
    // the context itself stays alive: React may re-attach this same canvas (StrictMode,
    // back/forward), and a lost context would leave the column flat
  }
}
