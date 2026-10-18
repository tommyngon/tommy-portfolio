// Offscreen "live picture" of the QBIKK AI orb (the pastel soft cube), for another WebGL
// renderer to upload as a texture each frame. Replicates QbikkSection's idle look in the
// light theme: same rotation drift, breathing squash, scale pulse and bob; level, energy,
// processing and bloom all at rest; dark theme (uDark = 1) on a deep grey-black.
import { CUBE_FRAG, CUBE_VERT } from "@/components/qbikk/cube-shader";

const UNIFORMS = ["uRes", "uTime", "uRot", "uSquash", "uLevel", "uEnergy", "uProc", "uBloom", "uScale", "uBg", "uDark"] as const;
type UniformName = (typeof UNIFORMS)[number];

const BG = [17 / 255, 17 / 255, 19 / 255] as const; // deep grey-black, #111113: the orb in its dark theme

// In the section the cube spans ~40% of its square canvas; enlarge it to ~58% of frame height.
const FRAME_SCALE = 1.05;
// The section bobs its canvas by up to ~12 css px on a ~1100 px canvas; as a fraction of
// frame height (scaled with the enlarged cube).
const BOB_FRAC = FRAME_SCALE / 1100;

function rotation(yaw: number, pitch: number, roll: number): Float32Array {
  const cY = Math.cos(yaw), sY = Math.sin(yaw), cP = Math.cos(pitch), sP = Math.sin(pitch), cR = Math.cos(roll), sR = Math.sin(roll);
  const Ry = [[cY, 0, sY], [0, 1, 0], [-sY, 0, cY]];
  const Rx = [[1, 0, 0], [0, cP, -sP], [0, sP, cP]];
  const Rz = [[cR, -sR, 0], [sR, cR, 0], [0, 0, 1]];
  const mul = (A: number[][], B: number[][]) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
  const M = mul(Rz, mul(Rx, Ry));
  return new Float32Array([M[0][0], M[1][0], M[2][0], M[0][1], M[1][1], M[2][1], M[0][2], M[1][2], M[2][2]]);
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error("shader");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(log || "shader");
  }
  return s;
}

export class OrbSource {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private buf: WebGLBuffer;
  private shaders: WebGLShader[];
  private U: Record<UniformName, WebGLUniformLocation | null>;
  private disposed = false;

  private constructor(
    canvas: HTMLCanvasElement,
    gl: WebGLRenderingContext,
    prog: WebGLProgram,
    buf: WebGLBuffer,
    shaders: WebGLShader[],
    U: Record<UniformName, WebGLUniformLocation | null>,
  ) {
    this.canvas = canvas;
    this.gl = gl;
    this.prog = prog;
    this.buf = buf;
    this.shaders = shaders;
    this.U = U;
  }

  static create(width = 640, height = 800): OrbSource | null {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, preserveDrawingBuffer: true });
    if (!gl) return null;
    const shaders: WebGLShader[] = [];
    let prog: WebGLProgram | null = null;
    let buf: WebGLBuffer | null = null;
    try {
      shaders.push(compile(gl, gl.VERTEX_SHADER, CUBE_VERT));
      shaders.push(compile(gl, gl.FRAGMENT_SHADER, CUBE_FRAG));
      prog = gl.createProgram();
      if (!prog) throw new Error("program");
      for (const s of shaders) gl.attachShader(prog, s);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
      gl.useProgram(prog);
      buf = gl.createBuffer();
      if (!buf) throw new Error("buffer");
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = {} as Record<UniformName, WebGLUniformLocation | null>;
      for (const n of UNIFORMS) U[n] = gl.getUniformLocation(prog, n);
      // constant idle uniforms
      gl.uniform1f(U.uLevel, 0);
      gl.uniform1f(U.uEnergy, 0);
      gl.uniform1f(U.uProc, 0);
      gl.uniform1f(U.uBloom, 0);
      gl.uniform3f(U.uBg, BG[0], BG[1], BG[2]);
      gl.uniform1f(U.uDark, 1);
      gl.viewport(0, 0, canvas.width, canvas.height);
      return new OrbSource(canvas, gl, prog, buf, shaders, U);
    } catch (e) {
      console.warn("Orb unavailable:", e);
      if (buf) gl.deleteBuffer(buf);
      if (prog) gl.deleteProgram(prog);
      for (const s of shaders) gl.deleteShader(s);
      return null;
    }
  }

  /** Draws one frame of the idle orb at `timeSec` (the section's `clock`). */
  render(timeSec: number): void {
    if (this.disposed) return;
    const { gl, U, canvas } = this;
    if (gl.isContextLost()) return;
    const clock = timeSec;
    const W = canvas.width, H = canvas.height;

    // QbikkSection idle: speed 0.34 rad/s from yaw 0.72
    const yaw = 0.72 + 0.34 * clock;
    const pitch = 0.5 + 0.17 * Math.sin(clock * 0.37) + 0.07 * Math.sin(clock * 0.83 + 1.3);
    const roll = 0.13 * Math.sin(clock * 0.29) + 0.06 * Math.sin(clock * 0.71 + 2.0);
    const sq0 = 1 + 0.035 * Math.sin(clock * 1.13);
    const sq1 = 1 + 0.035 * Math.sin(clock * 1.13 + 2.1);
    const sq2 = 1 + 0.035 * Math.sin(clock * 1.13 + 4.2);
    const scale = 1 + 0.025 * Math.sin(clock * 0.95);

    // bob (css px down/right in the section) -> shift the shader's centre via uRes, then
    // compensate uScale so the uv scale change doesn't resize the cube
    const bobY = (Math.sin(clock * 0.9) * 8 + Math.sin(clock * 0.37) * 4) * BOB_FRAC * H;
    const bobX = Math.sin(clock * 0.53) * 4 * BOB_FRAC * H;
    const resX = W + 2 * bobX; // centre x = W/2 + bobX
    const resY = H - 2 * bobY; // gl y is up: centre y = H/2 - bobY
    const uvComp = H / resY;

    gl.useProgram(this.prog);
    gl.viewport(0, 0, W, H);
    gl.uniform2f(U.uRes, resX, resY);
    gl.uniform1f(U.uTime, clock);
    gl.uniformMatrix3fv(U.uRot, false, rotation(yaw, pitch, roll));
    gl.uniform3f(U.uSquash, sq0, sq1, sq2);
    gl.uniform1f(U.uScale, scale * FRAME_SCALE * uvComp);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const { gl } = this;
    gl.deleteBuffer(this.buf);
    for (const s of this.shaders) {
      gl.detachShader(this.prog, s);
      gl.deleteShader(s);
    }
    gl.deleteProgram(this.prog);
    this.canvas.width = this.canvas.height = 1;
  }
}
