// Raw WebGL2 renderer for the home page's ending: one rough, broken chunk of red rock on a
// transparent square canvas. Own code.
//
// Shape: a block of planes with a few concave bites taken out of it (each bite the inside of
// three planes), its surface raised and lowered by relief: broad lumps, a network of cracks,
// pits and a fine grit. The relief is part of the distance field, so the outline itself is
// rough. A full-screen fragment shader sphere-traces that field from where the ray enters the
// block's grown hull, with over-relaxed steps; the closest approach of the ray gives the
// coverage, so the outline is antialiased, and an overshoot is brought back to the surface, so
// there are no stray specks at grazing angles.
//
// Detail is band-limited: the noise comes from a small tiling 3D texture of gradient noise
// (value and gradient per texel, baked on the GPU at start), the finer layers fade out by the
// pixel's footprint on the surface, and normals use the stored gradients, so nothing shimmers
// while the stone turns. Matte lighting: a raking key with soft shadows cast by the relief,
// fill, a red rim, ambient occlusion; grime in the hollows and on the underside, dust on the
// exposed edges, mineral specks. The pointer brings a warm light that skims the surface where
// it passes.
//
// The shaders compile in the background (KHR_parallel_shader_compile where available) and the
// canvas only draws when asked.

export type StoneFrame = {
  size: number; // css px, the canvas is a square of this side; the stone is centred in it
  unit: number; // css px per stone unit; the stone stays inside a radius of 1.4 units
  rot: Float32Array; // 3x3 rotation, column-major, object -> world
  lightX: number; // css px from the canvas's left edge, where the pointer light hovers
  lightY: number; // css px from the canvas's top edge
  light: number; // 0..1, how present the pointer light is
  form: number; // 0 a small soft bead .. 1 the finished rock
  alpha: number; // overall opacity
};

const NP = 26; // planes
const NN = 4; // concave bites
const CAM = 7; // camera distance, stone units: a long lens, only a hint of perspective
const REACH = 1.3; // the sharp block's farthest corner; with the relief the rock stays within 1.39
const BEAD = 0.35; // radius of the bead at form 0, units
const SEED = 29; // picks the stone
const NOISE = 64; // texels along each side of the noise texture (16 noise cells, 4 texels each)

// rotations that keep the noise layers from lining up, written into the shader as constants
function rotation(yaw: number, pitch: number, roll: number) {
  const cY = Math.cos(yaw), sY = Math.sin(yaw), cP = Math.cos(pitch), sP = Math.sin(pitch), cR = Math.cos(roll), sR = Math.sin(roll);
  const Ry = [[cY, 0, sY], [0, 1, 0], [-sY, 0, cY]];
  const Rx = [[1, 0, 0], [0, cP, -sP], [0, sP, cP]];
  const Rz = [[cR, -sR, 0], [sR, cR, 0], [0, 0, 1]];
  const mul = (A: number[][], B: number[][]) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
  const M = mul(Rz, mul(Rx, Ry));
  return `mat3(${[0, 1, 2].flatMap((c) => [0, 1, 2].map((r) => M[r][c].toFixed(6))).join(", ")})`;
}

const vec4s = (a: Float32Array) => {
  const out: string[] = [];
  for (let i = 0; i < a.length; i += 4) out.push(`vec4(${[0, 1, 2, 3].map((k) => a[i + k].toFixed(6)).join(", ")})`);
  return out.join(", ");
};

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const HASH = `
uint mix32(uint h) {
  h ^= h >> 15u;
  h *= 0x2c1b3c6du;
  h ^= h >> 12u;
  h *= 0x297a2d39u;
  h ^= h >> 15u;
  return h;
}`;

// Bakes one layer of the noise texture: gradient noise that tiles every 16 cells, its value in
// alpha and its gradient in rgb.
const BAKE = `#version 300 es
precision highp float;
precision highp int;
uniform float u_layer;
out vec4 o;
${HASH}
vec3 grad(ivec3 c) {
  uvec3 u = uvec3(c & 15);
  uint h = mix32(u.x * 0x8da6b343u ^ u.y * 0xd8163841u ^ u.z * 0xcb1ab31fu);
  return vec3(uvec3(h, h >> 10u, h >> 20u) & 1023u) * (2.0 / 1023.0) - 1.0;
}
void main() {
  vec3 p = vec3(gl_FragCoord.xy, u_layer + 0.5) * 0.25;
  ivec3 i = ivec3(floor(p));
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec3 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec3 ga = grad(i), gb = grad(i + ivec3(1, 0, 0)), gc = grad(i + ivec3(0, 1, 0)), gd = grad(i + ivec3(1, 1, 0));
  vec3 ge = grad(i + ivec3(0, 0, 1)), gf = grad(i + ivec3(1, 0, 1)), gg = grad(i + ivec3(0, 1, 1)), gh = grad(i + ivec3(1, 1, 1));
  float va = dot(ga, f), vb = dot(gb, f - vec3(1, 0, 0)), vc = dot(gc, f - vec3(0, 1, 0)), vd = dot(gd, f - vec3(1, 1, 0));
  float ve = dot(ge, f - vec3(0, 0, 1)), vf = dot(gf, f - vec3(1, 0, 1)), vg = dot(gg, f - vec3(0, 1, 1)), vh = dot(gh, f - vec3(1, 1, 1));
  float k1 = vb - va, k2 = vc - va, k3 = ve - va, k4 = va - vb - vc + vd;
  float k5 = va - vc - ve + vg, k6 = va - vb - ve + vf, k7 = -va + vb + vc - vd + ve - vf - vg + vh;
  float v = va + u.x * k1 + u.y * k2 + u.z * k3 + u.x * u.y * k4 + u.y * u.z * k5 + u.z * u.x * k6 + u.x * u.y * u.z * k7;
  vec3 g = ga + u.x * (gb - ga) + u.y * (gc - ga) + u.z * (ge - ga) + u.x * u.y * (ga - gb - gc + gd)
         + u.y * u.z * (ga - gc - ge + gg) + u.z * u.x * (ga - gb - ge + gf) + u.x * u.y * u.z * (-ga + gb + gc - gd + ge - gf - gg + gh);
  g += du * vec3(k1 + u.y * k4 + u.z * k6 + u.y * u.z * k7, k2 + u.z * k5 + u.x * k4 + u.z * u.x * k7, k3 + u.x * k6 + u.y * k5 + u.x * u.y * k7);
  o = vec4(g * 1.6 * 0.1 + 0.5, v * 1.6 * 0.4 + 0.5);
}`;

// the main shader, with the stone's planes written in as constants (much quicker to read than
// a uniform array in the inner loops)
const frag = (planes: Float32Array, bites: Float32Array) => `#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;
#define NP ${NP}
#define NN ${NN}
uniform vec2 u_res;      // backing px
uniform float u_px;      // units per backing px on the plane through the centre
uniform float u_cam;
uniform mat3 u_rot;
// planes in the stone's own space (unit normal, offset); the bites, three planes each, bounding
// the part taken away
const vec4 PL[NP] = vec4[NP](${vec4s(planes)});
const vec4 NT[NN * 3] = vec4[NN * 3](${vec4s(bites)});
uniform vec4 u_shape;    // scale, bead radius (own space), sphere -> rock, relief
uniform sampler3D u_noise;
uniform vec2 u_lp;       // pointer, world units
uniform float u_light;
uniform float u_alpha;
out vec4 o;

const float A_OUT = 0.09; // the relief rises at most this far above the block
const float A_ALL = 0.11; // ... and reaches at most this far either way
const mat3 M1 = ${rotation(0.3, 1.1, 0.4)};
const mat3 M2 = ${rotation(1.9, -0.6, 2.2)};
const mat3 M3 = ${rotation(-2.4, 0.9, -1.3)};
const mat3 M4 = ${rotation(0.8, -1.7, 2.9)};
const mat3 M5 = ${rotation(-1.2, 2.3, 0.6)};
${HASH}

// gradient noise from the texture: value, then gradient, per noise cell
vec4 nz(vec3 c) {
  vec4 t = texture(u_noise, c * 0.0625);
  return vec4(t.a * 2.5 - 1.25, t.rgb * 10.0 - 5.0);
}

// ---- the shape ------------------------------------------------------------------------------

// the block with its bites taken out (and, before the stone is formed, a sphere mixed in)
float block(vec3 p) {
  float d = -1e9;
  for (int i = 0; i < NP; i++) d = max(d, dot(p, PL[i].xyz) - PL[i].w);
  for (int j = 0; j < NN; j++) {
    vec4 a = NT[j * 3], b = NT[j * 3 + 1], c = NT[j * 3 + 2];
    d = max(d, -max(max(dot(p, a.xyz) - a.w, dot(p, b.xyz) - b.w), dot(p, c.xyz) - c.w));
  }
  return u_shape.z < 1.0 ? mix(length(p) - u_shape.y, d, u_shape.z) : d;
}

// a pixel's footprint where the field is being asked, to fade out the finest relief; and the
// lumps' and pits' noise at the last point asked, which the colour reuses
float g_fp = 0.003;
float g_lump = 0.0, g_pit = 0.0;

// Height of the relief above the block, and its gradient, in two parts. The broad part: lumps
// and a network of cracks along the zero sheet of one noise.
float reliefBroad(vec3 p, out vec3 g) {
  vec4 a = nz(M1 * p * 1.7 + vec3(3.1, 7.3, 1.9));
  vec4 b = nz(M2 * p * 3.6 + vec3(9.2, 2.4, 5.7));
  g_lump = a.x;
  float h = 0.034 * a.x;
  g = (0.034 * 1.7) * (a.yzw * M1);
  float sb = sqrt(b.x * b.x + 0.004);
  h += 0.046 * (sb - 0.35);
  g += (0.046 * 3.6 * b.x / sb) * (b.yzw * M2);
  g *= u_shape.w;
  return h * u_shape.w;
}
// The fine part: pits where another noise runs high, and a grit that fades out as it nears the
// size of a pixel. It lowers the surface by up to 0.016 and raises it by at most 0.008.
float reliefFine(vec3 p, out vec3 g) {
  vec4 c = nz(M3 * p * 8.0 + vec3(4.4, 11.8, 6.1));
  vec4 d = nz(M4 * p * 16.0 + vec3(7.7, 3.3, 0.6));
  g_pit = c.x;
  float e = clamp((c.x - 0.3) / 0.55, 0.0, 1.0);
  float h = -0.016 * e * e * (3.0 - 2.0 * e);
  g = (-0.016 * 8.0 * 6.0 * e * (1.0 - e) / 0.55) * (c.yzw * M3);
  float wd = 0.006 * (1.0 - smoothstep(0.15, 0.4, g_fp * 16.0));
  h += wd * d.x;
  g += (wd * 16.0) * (d.yzw * M4);
  g *= u_shape.w;
  return h * u_shape.w;
}

float field(vec3 p) {
  float d = block(p);
  if (d > A_ALL) return d - A_OUT; // the relief can't reach this far yet
  vec3 g;
  d -= reliefBroad(p, g);
  if (d > 0.03) return d - 0.008; // nor can the fine part
  return d - reliefFine(p, g);
}

// the same without the fine part, for the shadow and occlusion probes
float fieldBroad(vec3 p) {
  float d = block(p);
  if (d > A_ALL) return d - A_OUT;
  vec3 g;
  return d - reliefBroad(p, g);
}

// the span of the ray inside the block's planes (or the bead's sphere) grown by e
vec2 span(vec3 ro, vec3 rd, float e) {
  float b = dot(ro, rd);
  float R = u_shape.y + e;
  float c = dot(ro, ro) - R * R;
  float h = b * b - c;
  vec2 ts = h > 0.0 ? vec2(-b - sqrt(h), -b + sqrt(h)) : vec2(1e9, -1e9);
  if (u_shape.z <= 0.0) return ts;
  vec2 tp = vec2(-1e9, 1e9);
  for (int i = 0; i < NP; i++) {
    float dn = dot(PL[i].xyz, rd);
    float dist = PL[i].w + e - dot(PL[i].xyz, ro);
    if (abs(dn) < 1e-6) { if (dist < 0.0) tp = vec2(1e9, -1e9); }
    else if (dn > 0.0) tp.y = min(tp.y, dist / dn);
    else tp.x = max(tp.x, dist / dn);
  }
  if (u_shape.z >= 1.0) return tp;
  if (tp.x > tp.y) return ts;
  if (ts.x > ts.y) return tp;
  return vec2(min(ts.x, tp.x), max(ts.y, tp.y));
}

// ---- main -----------------------------------------------------------------------------------

float shoulder(float x) {
  const float a = 0.72;
  return x < a ? x : a + (1.0 - a) * (1.0 - exp(-(x - a) / (1.0 - a)));
}

void main() {
  vec2 xy = (gl_FragCoord.xy - 0.5 * u_res) * u_px;
  vec3 ro = vec3(0.0, 0.0, u_cam);
  vec3 rd = normalize(vec3(xy, -u_cam));
  mat3 inv = transpose(u_rot);
  float sc = u_shape.x;
  vec3 oro = inv * ro / sc;
  vec3 ord = inv * rd;

  // a pixel at the centre's depth, in the stone's own space; at depth t it is pxc * t / tc
  float pxc = u_px / sc;
  float tc = u_cam / sc;
  vec2 tt = span(oro, ord, A_OUT * u_shape.w + 2.0 * pxc);
  if (tt.x > tt.y) { o = vec4(0.0); return; }

  // sphere-trace from there, keeping the closest approach (in pixels) for the coverage. Steps
  // are over-relaxed while that is safe (taken back once two steps' spheres stop overlapping),
  // so rays skimming a face along its length still get there.
  float t = tt.x, tp = t;
  float dmin = 1e9, tmin = t;
  float fPrev = 0.0, stp = 0.0, w = 1.6;
  bool hit = false, gone = false;
  for (int i = 0; i < 96; i++) {
    float px = pxc * t / tc;
    g_fp = px;
    float f = field(oro + ord * t);
    float fs = f * 0.75; // a safe step: the relief makes the field steeper than 1
    if (w > 1.0 && fs + fPrev < stp) {
      t = tp + fPrev;
      w = 1.0;
      continue;
    }
    if (f / px < dmin) { dmin = f / px; tmin = t; }
    if (f < 0.3 * px) { hit = true; break; }
    fPrev = fs;
    // (and never shorter than a growing fraction of a pixel, so a ray skimming a face edge-on
    // keeps moving; if that lands it inside, the step back below finds the surface)
    stp = max(fs * w, px * (0.4 + 0.06 * float(i)));
    tp = t;
    t += stp;
    if (t > tt.y) { gone = true; break; }
  }
  if (hit) {
    // stepped past the surface: come back to it by false position between the last point
    // outside and this one
    float fh = field(oro + ord * t);
    if (fh < 0.0) {
      float lo = tp, hi = t, flo = field(oro + ord * tp);
      for (int i = 0; i < 2; i++) {
        float tm = mix(lo, hi, clamp(flo / (flo - fh), 0.1, 0.9));
        float fm = field(oro + ord * tm);
        if (fm < 0.0) { hi = tm; fh = fm; } else { lo = tm; flo = fm; }
      }
      t = mix(lo, hi, clamp(flo / (flo - fh), 0.0, 1.0));
    }
  } else {
    t = tmin;
  }
  // full inside the outline, falling off over a pixel outside it (a ray that runs out of steps
  // is one skimming a face edge-on, at the outline: it goes by its closest approach too)
  float cov = hit ? 1.0 : clamp(1.3 - dmin, 0.0, 1.0);
  if (cov <= 0.0) { o = vec4(0.0); return; }

  vec3 p = oro + ord * t;
  float px = pxc * t / tc;
  g_fp = px;

  // normal: the block's from differences a pixel apart (which also softens its edges to about
  // a pixel), less the relief's own gradient
  float hn = max(px, 0.002);
  const vec2 k = vec2(1.0, -1.0);
  vec3 gb = k.xyy * block(p + k.xyy * hn) + k.yyx * block(p + k.yyx * hn) + k.yxy * block(p + k.yxy * hn) + k.xxx * block(p + k.xxx * hn);
  vec3 gr, gf;
  float hf = reliefFine(p, gf);
  float hgt = reliefBroad(p, gr) + hf;
  gr += gf;
  float lump = g_lump, pitn = g_pit;
  vec3 n = normalize(gb / (4.0 * hn) - gr);
  float ndv0 = max(-dot(n, ord), 0.12);
  float fp = px / ndv0; // a pixel's footprint on the surface

  // fine tooth, in the shading only: two layers of grit, each fading out before it gets near
  // the size of a pixel
  vec4 d1 = nz(M5 * p * 34.0 + vec3(1.7, 5.2, 8.8));
  vec4 d2 = nz(M1 * p * 70.0 + vec3(6.3, 0.9, 3.4));
  float w1 = 1.0 - smoothstep(0.15, 0.4, fp * 34.0);
  float w2 = 1.0 - smoothstep(0.12, 0.32, fp * 70.0);
  // specks are a threshold of the noise, finer than the noise itself, so they go sooner
  float ws = 1.0 - smoothstep(0.08, 0.2, fp * 34.0);
  vec3 tb = (0.0055 * 34.0 * w1) * (d1.yzw * M5) + (0.0032 * 70.0 * w2) * (d2.yzw * M1);
  n = normalize(n - (tb - dot(tb, n) * n) * u_shape.w);

  // occlusion and exposure from the field a little way out along the normal (the probes leave
  // out the fine relief, taking it as it is here)
  float o2 = fieldBroad(p + n * 0.05) - hf;
  float o3 = fieldBroad(p + n * 0.16) - hf;
  float occ = clamp(1.0 - 0.6 * max(0.05 - o2, 0.0) / 0.05 - 0.35 * max(0.16 - o3, 0.0) / 0.16, 0.0, 1.0);
  float expo = clamp(1.0 * (o2 - 0.05) / 0.05 + 0.4 * (o3 - 0.16) / 0.16, 0.0, 1.0);

  vec3 P = u_rot * (p * sc);
  vec3 N = normalize(u_rot * n);
  vec3 V = normalize(ro - P);
  vec3 Lk = normalize(vec3(-0.74, 0.55, 0.38));
  // the key's shadow: a short march towards it through the field, soft by how near the ray
  // passes to the rock on the way
  vec3 lo = inv * Lk;
  float shad = 1.0, ts = 0.012;
  for (int i = 0; i < 5; i++) {
    float h = fieldBroad(p + n * 0.004 + lo * ts) - hf;
    shad = min(shad, 7.0 * h / ts);
    ts += clamp(h, 0.025, 0.16);
    if (shad < 0.0 || ts > 0.6) break;
  }
  shad = clamp(shad, 0.0, 1.0);
  shad = shad * shad * (3.0 - 2.0 * shad);

  // ---- colour: red rock, darker stains, dust, grime in the hollows, mineral specks ----
  float st = lump, sm = pitn * 0.8;
  vec3 red = vec3(0.46, 0.006, 0.006);
  vec3 alb = red * (0.82 + 0.14 * st + 0.08 * sm);
  // darker, hematite-rich patches with soft edges
  float stain = smoothstep(0.1, 0.9, st * 0.7 + sm * 0.45);
  alb = mix(alb, vec3(0.06, 0.01, 0.008), stain * 0.5);
  // dust: on exposed edges, on faces turned up (in the stone's own frame) and in patches
  float dusty = clamp(expo * 1.2 + smoothstep(0.2, 0.9, n.y) * 0.3 * smoothstep(-0.2, 0.6, sm) + smoothstep(0.4, 1.0, -st) * 0.3, 0.0, 1.0);
  alb = mix(alb, vec3(0.24, 0.12, 0.1), dusty * 0.38);
  // grit: dark specks and a few paler grains
  float dark = smoothstep(0.3, 0.85, d1.x) * ws;
  float pale = (1.0 - smoothstep(-0.95, -0.5, d1.x)) * ws;
  alb = mix(alb, vec3(0.035, 0.007, 0.006), dark * 0.6);
  alb = mix(alb, vec3(0.3, 0.22, 0.18), pale * 0.25);
  alb *= 1.0 + 0.12 * d2.x * w2;
  // the grit's own little hollows hold a little dirt
  alb *= 1.0 - (0.3 - 0.3 * d1.x) * w1 * 0.5 - (0.3 - 0.3 * d2.x) * w2 * 0.45;
  // grime gathered in the hollows: occluded spots, the cracks and the pits
  float low = 1.0 - smoothstep(-0.035, -0.008, hgt);
  float grime = clamp((1.0 - occ) * 1.6 + low * 0.5 + smoothstep(0.003, 0.014, -hf) * 0.55, 0.0, 1.0);
  // and a film of it over the underside (in the stone's own frame, so it turns with it)
  grime = max(grime, (1.0 - smoothstep(-0.7, 0.1, n.y)) * 0.35 * (0.6 + 0.4 * sm));
  alb = mix(alb, vec3(0.018, 0.008, 0.006), grime * 0.85);
  alb = mix(red * 0.9, alb, u_shape.w);

  // ---- light: matte ----
  float dk = max(dot(N, Lk), 0.0) * mix(1.0, shad, u_shape.w);
  vec3 Lf = normalize(vec3(0.85, -0.15, 0.5));
  float df = clamp((dot(N, Lf) + 0.2) / 1.2, 0.0, 1.0);
  float hemi = 0.5 + 0.5 * N.y;
  vec3 amb = mix(vec3(0.05, 0.04, 0.036), vec3(0.12, 0.12, 0.125), hemi) * occ;
  vec3 Lr = normalize(vec3(0.55, 0.5, -0.67));
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float dr = smoothstep(0.0, 0.7, dot(N, Lr)) * (1.0 - smoothstep(0.2, 0.6, ndv));
  vec3 diff = vec3(1.0, 0.95, 0.9) * 1.9 * dk + vec3(0.8, 0.86, 1.0) * 0.16 * df * occ + amb + vec3(1.0, 0.9, 0.85) * 0.4 * dr * occ;

  // the pointer's light hovers just above the surface where it is, so it skims across the
  // relief around it
  vec2 dp = u_lp - P.xy;
  float near = u_light * exp(-dot(dp, dp) / 0.55);
  vec3 Lp = normalize(vec3(dp, 0.42));
  diff += vec3(1.0, 0.8, 0.6) * 1.2 * near * max(dot(N, Lp), 0.0) * mix(1.0, occ, 0.5);

  // a faint dull sheen on the cleaner, flatter parts
  vec3 H = normalize(Lk + V);
  float nh = max(dot(N, H), 0.0);
  float a2 = 0.3;
  float dd = nh * nh * (a2 - 1.0) + 1.0;
  float sheen = 0.035 * a2 / (3.14159 * dd * dd) * dk * (1.0 - grime) * (1.0 - dusty) * u_shape.w;

  vec3 col = alb * diff + vec3(1.0, 0.95, 0.9) * sheen * 0.5;
  col = vec3(shoulder(col.r), shoulder(col.g), shoulder(col.b));
  col = pow(col, vec3(1.0 / 2.2));
  // a quarter of a level of dither, against banding in the deep reds
  uvec2 fc = uvec2(gl_FragCoord.xy);
  uint hd = mix32(fc.x * 0x8da6b343u ^ fc.y * 0xd8163841u);
  col += (float(hd >> 8u) * (1.0 / 16777216.0) - 0.5) * (0.5 / 255.0);

  o = vec4(col * cov, cov) * u_alpha;
}`;

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

const norm = (v: number[]) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// A spread of directions, each nudged hard, a few cut deeper to leave broad fracture faces and a
// few shallow ones knocking off corners; stretched a little so it reads as a chunk, not a die.
// Scaled so its farthest corner sits at REACH. Then a few bites: the inside of three planes
// meeting at a point just under the surface, opening outwards.
function stoneShape() {
  const r = rng(SEED);
  const aniso = [1.22, 0.84, 1.0];
  const pl: number[][] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < NP; i++) {
    const y = 1 - (2 * (i + 0.5)) / NP;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    const nx = Math.cos(th) * rad + (r() - 0.5) * 0.7;
    const ny = y + (r() - 0.5) * 0.5;
    const nz = Math.sin(th) * rad + (r() - 0.5) * 0.7;
    const kind = r();
    const w = kind < 0.3 ? 0.66 + r() * 0.08 : kind < 0.75 ? 0.78 + r() * 0.12 : 0.9 + r() * 0.12;
    // the plane n.(p / aniso) = w, written as a unit normal in the stretched space
    const m = norm([nx / aniso[0], ny / aniso[1], nz / aniso[2]]);
    const l = Math.hypot(nx / aniso[0], ny / aniso[1], nz / aniso[2]);
    pl.push([m[0], m[1], m[2], w / Math.hypot(nx, ny, nz) / l]);
  }
  // corners of the block, from every triple of planes; centred on their middle and scaled
  const corners: number[][] = [];
  for (let i = 0; i < NP; i++)
    for (let j = i + 1; j < NP; j++)
      for (let k = j + 1; k < NP; k++) {
        const v = solve3(pl[i], pl[j], pl[k]);
        if (v && pl.every((q) => q[0] * v[0] + q[1] * v[1] + q[2] * v[2] <= q[3] + 1e-5)) corners.push(v);
      }
  const lo = [0, 1, 2].map((a) => Math.min(...corners.map((v) => v[a])));
  const hi = [0, 1, 2].map((a) => Math.max(...corners.map((v) => v[a])));
  const c = lo.map((l, a) => (l + hi[a]) / 2);
  const far = Math.max(...corners.map((v) => Math.hypot(v[0] - c[0], v[1] - c[1], v[2] - c[2])));
  const k = REACH / far;
  const planes = new Float32Array(NP * 4);
  let mean = 0;
  const P = pl.map((q) => [q[0], q[1], q[2], (q[3] - q[0] * c[0] - q[1] * c[1] - q[2] * c[2]) * k]);
  P.forEach((q, i) => {
    planes.set(q, i * 4);
    mean += q[3] / NP;
  });
  // how far the block reaches along a direction
  const reach = (u: number[]) => Math.min(...P.filter((q) => dot3(q, u) > 1e-3).map((q) => q[3] / dot3(q, u)));
  const bites = new Float32Array(NN * 12);
  for (let j = 0; j < NN; j++) {
    const u = norm([r() * 2 - 1, (r() * 2 - 1) * 0.8, r() * 2 - 1]);
    const apex = reach(u) - (0.14 + r() * 0.12);
    const t1 = norm(cross(u, Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    const t2 = cross(u, t1);
    const turn = r() * Math.PI * 2;
    for (let s = 0; s < 3; s++) {
      // three faces round the axis u, uneven in angle and tilt, so each bite is its own shape
      const ang = turn + (s * Math.PI * 2) / 3 + (r() - 0.5) * 0.8;
      const half = 0.75 + r() * 0.35;
      const t = [0, 1, 2].map((a) => t1[a] * Math.cos(ang) + t2[a] * Math.sin(ang));
      const m = norm([0, 1, 2].map((a) => t[a] * Math.cos(half) - u[a] * Math.sin(half)));
      bites.set([m[0], m[1], m[2], dot3(m, u) * apex], (j * 3 + s) * 4);
    }
  }
  return { planes, bites, mean };
}

function solve3(a: number[], b: number[], c: number[]): number[] | null {
  const det = a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  if (Math.abs(det) < 1e-9) return null;
  const x = a[3] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[3] * c[2] - b[2] * c[3]) + a[2] * (b[3] * c[1] - b[1] * c[3]);
  const y = a[0] * (b[3] * c[2] - b[2] * c[3]) - a[3] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[3] - b[3] * c[0]);
  const z = a[0] * (b[1] * c[3] - b[3] * c[1]) - a[1] * (b[0] * c[3] - b[3] * c[0]) + a[3] * (b[0] * c[1] - b[1] * c[0]);
  return [x / det, y / det, z / det];
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const UNIFORMS = ["u_res", "u_px", "u_cam", "u_rot", "u_shape", "u_noise", "u_lp", "u_light", "u_alpha"] as const;
type U = Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

const nextFrame = () => new Promise<void>((res) => requestAnimationFrame(() => res()));

export class StoneRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private buf: WebGLBuffer;
  private tex: WebGLTexture;
  private U: U;
  private mean: number;
  private scale = 1;
  private disposed = false;

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, prog: WebGLProgram, buf: WebGLBuffer, tex: WebGLTexture, U: U, mean: number) {
    this.canvas = canvas;
    this.gl = gl;
    this.prog = prog;
    this.buf = buf;
    this.tex = tex;
    this.U = U;
    this.mean = mean;
  }

  // Resolves null without WebGL2 or on any error.
  static async create(canvas: HTMLCanvasElement): Promise<StoneRenderer | null> {
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
      const link = (fsrc: string) => {
        const vs = sh(gl.VERTEX_SHADER, VERT);
        const fs = sh(gl.FRAGMENT_SHADER, fsrc);
        const p = gl.createProgram()!;
        gl.attachShader(p, vs);
        gl.attachShader(p, fs);
        gl.bindAttribLocation(p, 0, "a_pos");
        gl.linkProgram(p);
        return { p, vs, fs };
      };
      const bake = link(BAKE);
      const shape = stoneShape();
      const main = link(frag(shape.planes, shape.bites));
      if (par) {
        while (!gl.getProgramParameter(bake.p, par.COMPLETION_STATUS_KHR) || !gl.getProgramParameter(main.p, par.COMPLETION_STATUS_KHR)) {
          if (gl.isContextLost()) return null;
          await nextFrame();
        }
      }
      for (const x of [bake, main]) {
        if (!gl.getProgramParameter(x.p, gl.LINK_STATUS)) {
          console.warn("stone shader", gl.getShaderInfoLog(x.fs) || gl.getProgramInfoLog(x.p));
          return null;
        }
        gl.deleteShader(x.vs);
        gl.deleteShader(x.fs);
      }

      const buf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      // the noise texture, one layer at a time
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_3D, tex);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, NOISE, NOISE, NOISE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.useProgram(bake.p);
      const layer = gl.getUniformLocation(bake.p, "u_layer");
      gl.viewport(0, 0, NOISE, NOISE);
      for (let z = 0; z < NOISE; z++) {
        gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, tex, 0, z);
        if (z === 0 && gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.deleteFramebuffer(fb);
          return null;
        }
        gl.uniform1f(layer, z);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fb);
      gl.deleteProgram(bake.p);

      const prog = main.p;
      gl.useProgram(prog);
      const U = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(prog, n)])) as U;
      gl.uniform1f(U.u_cam, CAM);
      gl.uniform1i(U.u_noise, 0);
      gl.clearColor(0, 0, 0, 0);
      // one invisible draw now, so drivers that build the pipeline on first use (Safari) do it
      // here rather than on the first frame the stone is seen
      gl.viewport(0, 0, 1, 1);
      gl.uniform2f(U.u_res, 1, 1);
      gl.uniform1f(U.u_px, 3);
      gl.uniformMatrix3fv(U.u_rot, false, new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
      gl.uniform4f(U.u_shape, 1, shape.mean, 1, 1);
      gl.uniform1f(U.u_alpha, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (gl.isContextLost()) return null;
      return new StoneRenderer(canvas, gl, prog, buf, tex, U, shape.mean);
    } catch (e) {
      console.warn("stone", e);
      return null;
    }
  }

  // backing-store pixels per css px
  setScale(s: number) {
    this.scale = s;
  }

  render(f: StoneFrame) {
    if (this.disposed || this.gl.isContextLost()) return;
    const { gl, U, canvas } = this;
    const side = Math.max(1, Math.round(f.size * this.scale));
    if (canvas.width !== side || canvas.height !== side) {
      canvas.width = side;
      canvas.height = side;
    }
    gl.viewport(0, 0, side, side);
    if (!(f.alpha > 0)) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, this.tex);

    // the bead grows into the rock while its sphere gives way to the block and the relief rises
    const form = Math.min(1, Math.max(0, f.form));
    const s0 = BEAD / this.mean;
    const scale = s0 + (1 - s0) * smooth(0, 1, form);
    gl.uniform4f(U.u_shape, scale, this.mean, smooth(0.05, 0.85, form), smooth(0.3, 1, form));

    const u = Math.max(1e-3, f.unit);
    gl.uniform2f(U.u_res, side, side);
    gl.uniform1f(U.u_px, f.size / side / u);
    gl.uniformMatrix3fv(U.u_rot, false, f.rot);
    gl.uniform2f(U.u_lp, (f.lightX - f.size / 2) / u, (f.size / 2 - f.lightY) / u);
    gl.uniform1f(U.u_light, Math.min(1, Math.max(0, f.light)));
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
