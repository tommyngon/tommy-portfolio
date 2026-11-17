// Raw WebGL2 renderer for the home page's ending: the pinned name turns into a red stone and
// back. Own code. One full-screen fragment shader ray-marches a signed distance field that is
// a blend of two shapes:
//   - the name, as a slab extruded from a 2D distance field of the very letters on the page
//     (drawn with the same font at the same positions, so frame one matches the live text);
//   - a knapped stone: a convex block of tilted planes, a few shallow scallops cut into it
//     (like flint) and fine grit near the surface.
// Mixing the two distance fields gives a true metamorphosis: the letters swell, run together
// and harden into facets. Lit by a lagging point light that follows the pointer, with a
// scatter of facets ("shards") catching the light around it.
//
// Nothing here runs until the page asks for it: the module is imported once the ending is
// close, the shaders compile in the background (KHR_parallel_shader_compile where available)
// and the canvas only draws when something has changed.

export type NameLayout = {
  family: string; // computed font-family of the live letters
  weight: string;
  letters: { ch: string; x: number }[]; // left edge of each glyph box, em from the box's left
  width: number; // em
  baseline: number; // em from the box's top (the box is 1em tall: line-height 1)
};

export type StoneFrame = {
  vw: number; // canvas css px
  vh: number;
  cx: number; // object centre, css px from the canvas's top-left
  cy: number;
  font: number; // css px per em of the name
  stone: number; // css px per stone unit (the stone is about two units across)
  morph: number; // 0 name .. 1 stone
  squeeze: number; // horizontal scale of the name (1 = as set)
  depth: number; // half depth of the letters, em
  swell: number; // em the letters grow by as they run together
  blend: number; // 0..1, from the letters' field to the stone's
  yaw: number;
  pitch: number;
  roll: number;
  lightX: number; // css px, the point light's position over the page
  lightY: number;
  shards: number; // 0..1, facets catching the light around the pointer
  flat: number; // 1 = the name's flat red, 0 = fully lit
  glow: number; // 0..1, the name's halo
  alpha: number; // overall opacity (cross-fades with the live text)
  u: number; // the page's unit, 100vw / 1470, for the halo radii
};

const NP = 24; // stone planes
const NS = 3; // scallops
const TEX_EM = 160; // texels per em in the name's distance field
const PAD = 0.4; // em of empty margin around the name in that field

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
precision highp sampler2D;
#define NP ${NP}
#define NS ${NS}
uniform vec2 u_vp;
uniform float u_dpr;
uniform float u_focal;
uniform vec3 u_center;
uniform mat3 u_rot;
uniform vec3 u_box;
uniform float u_font;
uniform float u_stone;
uniform float u_morph;
uniform float u_squeeze;
uniform float u_depth;
uniform vec4 u_mix;      // swell (px), blend from the letters to the stone (0..1)
uniform sampler2D u_sdf;
uniform vec4 u_tex;      // min.xy, size.xy of the field, em (y up)
uniform float u_pad;
uniform vec4 u_planes[NP];
uniform vec4 u_scoops[NS];
uniform vec3 u_aniso;
uniform float u_lip;
uniform vec3 u_light;
uniform vec3 u_cursor;   // world xy, z = amount
uniform float u_flat;
uniform float u_glow;
uniform vec3 u_glowR;    // halo radii, px
uniform float u_alpha;
out vec4 o;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x);
  float b = mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x);
  float c = mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x);
  float d = mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}

// the name's 2D distance, em (negative inside); outside the field, the distance to its edge
// plus the margin is a safe lower bound
// (squared length for the test: length() of a zero vector is not reliably zero on every GPU)
float text2D(vec2 e) {
  vec2 uv = (e - u_tex.xy) / u_tex.zw;
  vec2 c = clamp(uv, 0.0, 1.0);
  float d = textureLod(u_sdf, vec2(c.x, 1.0 - c.y), 0.0).r;
  vec2 off = (uv - c) * u_tex.zw;
  float o2 = dot(off, off);
  return o2 > 1e-12 ? sqrt(o2) + u_pad : d;
}

// the letters as a slab whose front face lies on z = 0, px
float textD(vec3 p) {
  vec3 e = p / u_font;
  e.x /= u_squeeze;
  e.z += u_depth;
  float d2 = text2D(e.xy);
  float r = min(0.03, u_depth * 0.5);
  vec2 w = vec2(d2 + r, abs(e.z) - u_depth + r);
  float d = min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - r;
  return d * u_font * u_squeeze;
}

float stoneBase(vec3 q) {
  vec3 a = q / u_aniso;
  float d = -1e5;
  for (int i = 0; i < NP; i++) d = max(d, dot(a, u_planes[i].xyz) - u_planes[i].w);
  d *= u_lip;
  for (int i = 0; i < NS; i++) d = max(d, u_scoops[i].w - length(q - u_scoops[i].xyz));
  return d;
}

// stone units in, px out
float stoneD(vec3 p) {
  vec3 q = p / u_stone;
  float d = stoneBase(q);
  if (d < 0.08) d += (vnoise(q * 7.0) - 0.5) * 0.022 + (vnoise(q * 21.0) - 0.5) * 0.008;
  return d * u_stone;
}

// The metamorphosis: the letters draw together, thicken and swell, and the field slides from
// theirs to the stone's; squeezed to fit inside the stone first, no letter is cut off on the way.
float map(vec3 p) {
  if (u_morph <= 0.0) return textD(p);
  if (u_morph >= 1.0) return stoneD(p);
  float a = textD(p) - u_mix.x;
  float b = stoneD(p);
  // mid-way the surface breathes a little, so the change reads as material, not a cross-fade
  float w = sin(3.14159 * u_mix.y);
  float n = (vnoise(p / u_stone * 2.4 + 7.0) - 0.5) * 0.06 * u_stone * w;
  return mix(a, b, u_mix.y) + n;
}

vec3 normalAt(vec3 p, float h) {
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * map(p + k.xyy * h) + k.yyx * map(p + k.yyx * h) +
                   k.yxy * map(p + k.yxy * h) + k.xxx * map(p + k.xxx * h));
}

vec2 boxHit(vec3 ro, vec3 rd, vec3 b) {
  vec3 m = 1.0 / rd;
  vec3 n = m * ro;
  vec3 k = abs(m) * b;
  vec3 t1 = -n - k;
  vec3 t2 = -n + k;
  return vec2(max(max(t1.x, t1.y), t1.z), min(min(t2.x, t2.y), t2.z));
}

// facets around the pointer: a jittered lattice of cells, each tilting the surface its own way;
// w is the gap between the nearest and second-nearest cell, small along the cracks between them
vec4 cells(vec3 q) {
  vec3 i = floor(q);
  vec3 f = fract(q);
  float f1 = 8.0;
  float f2 = 8.0;
  vec3 id = vec3(0.0);
  for (int z = -1; z <= 1; z++)
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 r = g + hash33(i + g) - f;
        float d = dot(r, r);
        if (d < f1) { f2 = f1; f1 = d; id = i + g; }
        else if (d < f2) f2 = d;
      }
  return vec4(hash33(id * 1.37 + 11.0), sqrt(f2) - sqrt(f1));
}

void main() {
  vec2 css = gl_FragCoord.xy / u_dpr;
  vec3 ro = vec3(0.0, 0.0, u_focal);
  vec3 rd = normalize(vec3(css - 0.5 * u_vp, 0.0) - ro);
  mat3 inv = transpose(u_rot);
  vec3 oro = inv * (ro - u_center);
  vec3 ord = inv * rd;
  vec2 tb = boxHit(oro, ord + 1e-7, u_box);
  if (tb.x > tb.y || tb.y < 0.0) { o = vec4(0.0); return; }

  float t = max(tb.x, 0.0);
  float dmin = 1e9;
  float tAt = t;
  bool hit = false;
  for (int i = 0; i < 96; i++) {
    float d = map(oro + ord * t);
    if (d < dmin) { dmin = d; tAt = t; }
    if (d < 0.15) { hit = true; tAt = t; break; }
    t += d * 0.72 + 0.04;
    if (t > tb.y) break;
  }

  // coverage: exact 2D antialiasing on the flat front of the letters, the closest approach of
  // the ray everywhere else
  vec3 p = oro + ord * tAt;
  float sd = hit ? -1.0 : dmin;
  if (u_flat > 0.0 && p.z > -1.0 && u_morph < 0.5) {
    vec3 e = p / u_font;
    float d2 = text2D(vec2(e.x / u_squeeze, e.y)) * u_font * u_squeeze;
    if (hit || d2 < 1.5) sd = d2;
  }
  float a = clamp(0.5 - sd * u_dpr, 0.0, 1.0);

  vec3 col = vec3(0.0);
  if (a > 0.0) {
    vec3 n = normalAt(p, 0.55);
    vec3 N = u_rot * n;
    vec3 P = u_rot * p + u_center;
    vec3 V = -rd;
    vec3 q = p / u_stone;

    float st = smoothstep(0.1, 0.8, u_morph); // how much of the stone's surface shows

    // albedo: deep oxblood, darker and lighter veins, dusty flecks, fine grain
    float n1 = vnoise(q * 1.7 + 3.0);
    float n2 = vnoise(q * 8.5);
    float n3 = vnoise(q * 41.0);
    vec3 stoneAlb = mix(vec3(0.07, 0.0035, 0.003), vec3(0.2, 0.012, 0.009), n1);
    float dust = smoothstep(0.58, 0.86, n1) * smoothstep(0.4, 0.82, n2);
    stoneAlb = mix(stoneAlb, vec3(0.36, 0.12, 0.095), dust * 0.55);
    stoneAlb *= 0.78 + 0.44 * n3;
    vec3 alb = mix(vec3(0.36, 0.0, 0.0), stoneAlb, st);

    // grain: a fine bump on the stone's normal
    if (st > 0.0) {
      vec3 gq = q * 64.0;
      float g0 = vnoise(gq);
      vec3 gr = vec3(vnoise(gq + vec3(0.4, 0.0, 0.0)), vnoise(gq + vec3(0.0, 0.4, 0.0)), vnoise(gq + vec3(0.0, 0.0, 0.4))) - g0;
      gr = u_rot * gr;
      N = normalize(N + (gr - dot(gr, N) * N) * 1.3 * st);
    }

    // shards: facets around the pointer catch the light their own way
    vec2 dc = P.xy - u_cursor.xy;
    float sw = u_cursor.z * exp(-dot(dc, dc) / (u_stone * u_stone * 0.16)) * smoothstep(0.6, 1.0, u_morph);
    float edge = 0.0;
    if (sw > 0.01) {
      vec4 c = cells(q * 11.0);
      N = normalize(mix(N, normalize(N + (c.xyz - 0.5) * 1.7), sw));
      alb *= mix(1.0, 0.45 + 1.0 * c.x, sw);
      edge = sw * (1.0 - smoothstep(0.0, 0.09, c.w));
    }

    float ndv = max(dot(N, V), 1e-3);
    // the pointer's light, close in front: it finds the grain wherever it goes
    vec3 Lv = u_light - P;
    float dist = length(Lv);
    vec3 L = Lv / dist;
    vec3 H = normalize(L + V);
    float ndl = max(dot(N, L), 0.0);
    float ndh = max(dot(N, H), 0.0);
    float rough = mix(0.34, 0.52, st);
    float r2 = rough * rough;
    float r4 = r2 * r2;
    float dd = ndh * ndh * (r4 - 1.0) + 1.0;
    float D = r4 / (3.14159 * dd * dd);
    float F = 0.05 + 0.95 * pow(clamp(1.0 - dot(H, V), 0.0, 1.0), 5.0);
    float G = 0.5 / mix(2.0 * ndl * ndv, ndl + ndv, r2);
    float atten = 1.0 / (1.0 + pow(dist / (u_stone * 2.2), 2.0));
    vec3 key = vec3(1.0, 0.92, 0.84) * 3.4 * atten;
    // a light from behind and above, wrapping round the edges
    vec3 Lb = normalize(vec3(0.35, 0.75, -0.55));
    float back = max(dot(N, Lb) + 0.35, 0.0) / 1.35;
    // a dim sky from above
    float hemi = 0.5 + 0.5 * N.y;
    vec3 amb = mix(vec3(0.03, 0.012, 0.012), vec3(0.3, 0.29, 0.28), hemi) * mix(0.9, 0.38, st);
    float fres = pow(clamp(1.0 - ndv, 0.0, 1.0), 3.5);
    vec3 rim = vec3(1.0, 0.3, 0.2) * fres * (0.25 + 0.75 * back) * 0.9;
    vec3 lit = alb * (amb + key * ndl + vec3(1.0, 0.55, 0.45) * back * 0.55 * st)
             + key * D * F * G * ndl + rim * (0.12 + alb) - edge * alb * 0.7;
    lit = max(lit, 0.0);
    lit = lit / (1.0 + lit * 0.6);
    col = pow(lit, vec3(1.0 / 2.2));
    col = mix(col, vec3(0.635, 0.0, 0.0), u_flat);
  }

  // the halo: three soft rims like the live text's shadows
  float g = max(dmin, 0.0);
  vec3 s = 0.5 * u_glowR;
  vec3 k = vec3(0.45, 0.22, 0.12) * 0.3 * exp(-0.5 * (g * g) / (s * s)) * u_glow;
  float ga = clamp(k.x + k.y + k.z, 0.0, 1.0) * (1.0 - a);
  vec3 gc = (vec3(1.0, 0.275, 0.196) * k.x + vec3(1.0, 0.176, 0.118) * k.y + vec3(0.824, 0.0, 0.0) * k.z) * (1.0 - a);

  o = vec4(col * a + gc, a + ga) * u_alpha;
}`;

const idle = () =>
  new Promise<void>((res) => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => res(), { timeout: 400 });
    else window.setTimeout(res, 16);
  });

// ---- the name's distance field --------------------------------------------------------------

const INF = 1e20;

// 1D squared Euclidean distance transform (Felzenszwalb & Huttenlocher), in place
function edt1d(g: Float32Array, offset: number, stride: number, n: number, f: Float64Array, v: Uint32Array, z: Float64Array) {
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  f[0] = g[offset];
  for (let q = 1, k = 0; q < n; q++) {
    f[q] = g[offset + q * stride];
    const q2 = q * q;
    let s = 0;
    do {
      const r = v[k];
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  for (let q = 0, k = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k];
    const d = q - r;
    g[offset + q * stride] = f[r] + d * d;
  }
}

// Draws the letters and returns their signed distance (em, negative inside) as half floats.
// The work is cut into slices of a few milliseconds, each in its own idle moment, so building
// it never holds up a frame while the visitor scrolls.
async function nameField(layout: NameLayout) {
  const w = Math.ceil((layout.width + 2 * PAD) * TEX_EM);
  const h = Math.ceil((1 + 2 * PAD) * TEX_EM);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.font = `${layout.weight} ${TEX_EM}px ${layout.family}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  const y = (PAD + layout.baseline) * TEX_EM;
  for (const l of layout.letters) ctx.fillText(l.ch, (PAD + l.x) * TEX_EM, y);
  const px = ctx.getImageData(0, 0, w, h).data;
  await idle();

  const n = w * h;
  const outer = new Float32Array(n);
  const inner = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = px[i * 4 + 3] / 255;
    outer[i] = a === 1 ? 0 : a === 0 ? INF : Math.max(0, 0.5 - a) ** 2;
    inner[i] = a === 1 ? INF : a === 0 ? 0 : Math.max(0, a - 0.5) ** 2;
  }
  const m = Math.max(w, h);
  const f = new Float64Array(m);
  const v = new Uint32Array(m);
  const z = new Float64Array(m + 1);
  const STEP = 240; // lines per slice
  for (const g of [outer, inner]) {
    for (let x0 = 0; x0 < w; x0 += STEP) {
      await idle();
      for (let x = x0; x < Math.min(w, x0 + STEP); x++) edt1d(g, x, w, h, f, v, z);
    }
    for (let y0 = 0; y0 < h; y0 += STEP / 6) {
      await idle();
      for (let yy = y0; yy < Math.min(h, y0 + STEP / 6); yy++) edt1d(g, yy * w, 1, w, f, v, z);
    }
  }
  await idle();
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (Math.sqrt(outer[i]) - Math.sqrt(inner[i])) / TEX_EM;
  await idle();
  return { data: toHalf(out), w, h, emW: w / TEX_EM, emH: h / TEX_EM };
}

// float32 to IEEE half, rounded; R16F filters linearly everywhere (R32F does not on phones),
// and handing it half floats directly avoids a conversion some drivers get wrong
function toHalf(src: Float32Array): Uint16Array {
  const out = new Uint16Array(src.length);
  const f = new Float32Array(1);
  const b = new Uint32Array(f.buffer);
  for (let i = 0; i < src.length; i++) {
    f[0] = src[i];
    const x = b[0];
    const sign = (x >>> 16) & 0x8000;
    const e = ((x >>> 23) & 0xff) - 112;
    const m = x & 0x7fffff;
    if (e <= 0) out[i] = e < -10 ? sign : sign | (((m | 0x800000) >> (1 - e)) + 0x1000) >> 13;
    else if (e >= 31) out[i] = sign | 0x7c00;
    else out[i] = sign | ((e << 10) + ((m + 0x1000) >> 13));
  }
  return out;
}

// ---- the stone ------------------------------------------------------------------------------

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// a block of tilted planes: an even spread of directions, each nudged, a few cut deeper to
// leave broad faces; then three shallow scallops, as if flakes had been struck off
function stoneShape() {
  const r = rng(11);
  const planes = new Float32Array(NP * 4);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < NP; i++) {
    const y = 1 - (2 * (i + 0.5)) / NP;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    let nx = Math.cos(th) * rad + (r() - 0.5) * 0.55;
    let ny = y + (r() - 0.5) * 0.45;
    let nz = Math.sin(th) * rad + (r() - 0.5) * 0.55;
    const l = Math.hypot(nx, ny, nz);
    nx /= l;
    ny /= l;
    nz /= l;
    const deep = r() < 0.32;
    planes.set([nx, ny, nz, deep ? 0.68 + r() * 0.1 : 0.8 + r() * 0.18], i * 4);
  }
  const scoops = new Float32Array(NS * 4);
  const dirs = [
    [0.55, 0.35, 0.75],
    [-0.7, -0.15, 0.6],
    [0.1, 0.85, 0.35],
  ];
  dirs.forEach(([x, y, z], i) => {
    const l = Math.hypot(x, y, z);
    const rr = 0.85 + r() * 0.35;
    const reach = 0.86 + rr - 0.06; // the sphere dips ~0.06 below the surface
    scoops.set([(x / l) * reach * 1.2, (y / l) * reach * 0.85, (z / l) * reach, rr], i * 4);
  });
  return { planes, scoops, aniso: [1.22, 0.86, 1.0] as const };
}

function rotation(yaw: number, pitch: number, roll: number): Float32Array {
  const cY = Math.cos(yaw), sY = Math.sin(yaw), cP = Math.cos(pitch), sP = Math.sin(pitch), cR = Math.cos(roll), sR = Math.sin(roll);
  const Ry = [[cY, 0, sY], [0, 1, 0], [-sY, 0, cY]];
  const Rx = [[1, 0, 0], [0, cP, -sP], [0, sP, cP]];
  const Rz = [[cR, -sR, 0], [sR, cR, 0], [0, 0, 1]];
  const mul = (A: number[][], B: number[][]) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
  const M = mul(Rz, mul(Rx, Ry));
  // column-major for uniformMatrix3fv
  return new Float32Array([M[0][0], M[1][0], M[2][0], M[0][1], M[1][1], M[2][1], M[0][2], M[1][2], M[2][2]]);
}

const UNIFORMS = [
  "u_vp", "u_dpr", "u_focal", "u_center", "u_rot", "u_box", "u_font", "u_stone", "u_morph", "u_squeeze", "u_depth", "u_mix",
  "u_sdf", "u_tex", "u_pad", "u_planes", "u_scoops", "u_aniso", "u_lip", "u_light", "u_cursor", "u_flat", "u_glow",
  "u_glowR", "u_alpha",
] as const;
type U = Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

const nextFrame = () => new Promise<void>((res) => requestAnimationFrame(() => res()));

export class StoneRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private buf: WebGLBuffer;
  private tex: WebGLTexture;
  private U: U;
  private emW: number;
  private scale = 1;
  private disposed = false;

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, prog: WebGLProgram, buf: WebGLBuffer, tex: WebGLTexture, U: U, emW: number) {
    this.canvas = canvas;
    this.gl = gl;
    this.prog = prog;
    this.buf = buf;
    this.tex = tex;
    this.U = U;
    this.emW = emW;
  }

  // Everything heavy is spread over idle time and frames; resolves null without WebGL2 or on any error.
  static async create(canvas: HTMLCanvasElement, layout: NameLayout): Promise<StoneRenderer | null> {
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "high-performance" });
    if (!gl) return null;
    try {
      const par = gl.getExtension("KHR_parallel_shader_compile");
      const sh = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
      };
      const vs = sh(gl.VERTEX_SHADER, VERT);
      const fs = sh(gl.FRAGMENT_SHADER, FRAG);
      const prog = gl.createProgram()!;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (par) {
        while (!gl.getProgramParameter(prog, par.COMPLETION_STATUS_KHR)) {
          if (gl.isContextLost()) return null;
          await nextFrame();
        }
      }
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.warn("stone shader", gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(prog));
        return null;
      }
      gl.deleteShader(vs);
      gl.deleteShader(fs);

      const field = await nameField(layout);
      if (!field || gl.isContextLost()) return null;

      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, field.w, field.h, 0, gl.RED, gl.HALF_FLOAT, field.data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const buf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.useProgram(prog);
      const loc = gl.getAttribLocation(prog, "a_pos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const U = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(prog, n)])) as U;
      const shape = stoneShape();
      gl.uniform1i(U.u_sdf, 0);
      gl.uniform4f(U.u_tex, -field.emW / 2, -field.emH / 2, field.emW, field.emH);
      gl.uniform1f(U.u_pad, PAD * 0.95);
      gl.uniform4fv(U.u_planes, shape.planes);
      gl.uniform4fv(U.u_scoops, shape.scoops);
      gl.uniform3f(U.u_aniso, ...shape.aniso);
      gl.uniform1f(U.u_lip, Math.min(...shape.aniso));
      gl.clearColor(0, 0, 0, 0);
      // one invisible draw now, so drivers that build the pipeline on first use (Safari) do it
      // here rather than on the first frame of the hand-over
      gl.viewport(0, 0, 1, 1);
      gl.uniform1f(U.u_alpha, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (gl.isContextLost()) return null;
      return new StoneRenderer(canvas, gl, prog, buf, tex, U, layout.width);
    } catch (e) {
      console.warn("stone", e);
      return null;
    }
  }

  // resolution: css size times the capped device ratio times a quality factor (lowered when slow)
  setScale(s: number) {
    this.scale = s;
  }

  render(f: StoneFrame) {
    if (this.disposed || this.gl.isContextLost()) return;
    const { gl, U, canvas } = this;
    const k = this.scale;
    const w = Math.max(1, Math.round(f.vw * k));
    const h = Math.max(1, Math.round(f.vh * k));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);

    const focal = 2.2 * Math.max(f.vw, f.vh);
    gl.uniform2f(U.u_vp, f.vw, f.vh);
    gl.uniform1f(U.u_dpr, w / f.vw);
    gl.uniform1f(U.u_focal, focal);
    gl.uniform3f(U.u_center, f.cx - f.vw / 2, f.vh / 2 - f.cy, 0);
    gl.uniformMatrix3fv(U.u_rot, false, rotation(f.yaw, f.pitch, f.roll));

    const glowR = [1.5 * f.u, 10 * f.u, 26 * f.u].map((r, i) => Math.max([1, 6, 14][i], r));
    const glowPad = f.glow > 0.01 ? glowR[2] * 1.6 : 2;
    const m = f.morph;
    const sw = f.swell * f.font;
    const tx = (this.emW / 2 + 0.05) * f.font * f.squeeze + sw;
    const ty = 0.62 * f.font + sw;
    const tz = (2 * f.depth + 0.05) * f.font + sw;
    const sr = 1.45 * f.stone;
    const bx = m <= 0 ? tx : m >= 1 ? sr : Math.max(tx, sr) * 1.08;
    const by = m <= 0 ? ty : m >= 1 ? sr : Math.max(ty, sr) * 1.08;
    const bz = m <= 0 ? tz : m >= 1 ? sr : Math.max(tz, sr) * 1.08;
    gl.uniform3f(U.u_box, bx + glowPad, by + glowPad, bz + glowPad);

    gl.uniform1f(U.u_font, f.font);
    gl.uniform1f(U.u_stone, f.stone);
    gl.uniform1f(U.u_morph, m);
    gl.uniform1f(U.u_squeeze, f.squeeze);
    gl.uniform1f(U.u_depth, f.depth);
    gl.uniform4f(U.u_mix, sw, f.blend, 0, 0);
    gl.uniform3f(U.u_light, f.lightX - f.vw / 2, f.vh / 2 - f.lightY, 1.9 * f.stone);
    gl.uniform3f(U.u_cursor, f.lightX - f.vw / 2, f.vh / 2 - f.lightY, f.shards);
    gl.uniform1f(U.u_flat, f.flat);
    gl.uniform1f(U.u_glow, f.glow);
    gl.uniform3f(U.u_glowR, glowR[0], glowR[1], glowR[2]);
    gl.uniform1f(U.u_alpha, f.alpha);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  clear() {
    if (this.disposed || this.gl.isContextLost()) return;
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const { gl } = this;
    gl.deleteTexture(this.tex);
    gl.deleteBuffer(this.buf);
    gl.deleteProgram(this.prog);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
