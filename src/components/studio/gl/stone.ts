// Raw WebGL2 renderer for the home page's ending: one polished red stone on a transparent square
// canvas. Own code. A single full-screen fragment shader traces a convex block of planes whose
// edges are rounded by a smooth maximum (log-sum-exp), so every facet is a clean plane and every
// edge a soft bevel. Because the shape is convex, the field is convex along each ray: the closest
// approach is found by bisecting its slope and the surface by Newton steps from the entry side.
// That gives an exact, noise-free silhouette with analytic coverage and an analytic normal, and
// no ray-march speckle at grazing angles.
//
// The material is band-limited on purpose: slow, domain-warped banding and a couple of thin pale
// veins in the colour, a very gentle undulation in the normal, nothing finer than a pixel, so the
// stone stays calm while it turns. Lit by a soft studio key, fill and rim, a procedural studio
// environment for the polish, and a small warm light that follows the pointer.
//
// The shader compiles in the background (KHR_parallel_shader_compile where available) and the
// canvas only draws when asked.

export type StoneFrame = {
  size: number; // css px, the canvas is a square of this side; the stone is centred in it
  unit: number; // css px per stone unit; the stone stays inside a radius of 1.4 units
  rot: Float32Array; // 3x3 rotation, column-major, object -> world
  lightX: number; // css px from the canvas's left edge, where the pointer light hovers
  lightY: number; // css px from the canvas's top edge
  light: number; // 0..1, how present the pointer light is
  form: number; // 0 a small soft bead .. 1 the finished faceted stone
  alpha: number; // overall opacity
};

const NP = 22; // planes
const CAM = 7; // camera distance, stone units: a long lens, only a hint of perspective
const REACH = 1.38; // the sharp block's farthest corner (the rounded stone lies within it), under the 1.4 promised
const BEAD = 0.35; // radius of the bead at form 0, units
const SEED = 29; // picks the stone
const PILLOW = 0.88; // the finished stone keeps a tenth of the sphere, so its faces are gently domed, as tumbled

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
precision highp int;
#define NP ${NP}
uniform vec2 u_res;      // backing px
uniform float u_px;      // units per backing px on the plane through the centre
uniform float u_cam;
uniform mat3 u_rot;
uniform vec4 u_pl[NP];   // planes in the stone's own space: unit normal, offset
uniform vec4 u_shape;    // scale, bead radius (own space), sphere -> planes, edge softness
uniform float u_tex;     // how much of the banding shows
uniform vec3 u_lp;       // pointer light, world units
uniform float u_light;
uniform float u_alpha;
out vec4 o;

// ---- noise: integer hash, gradient noise with its derivatives -----------------------------

uint mix32(uint h) {
  h ^= h >> 15u;
  h *= 0x2c1b3c6du;
  h ^= h >> 12u;
  h *= 0x297a2d39u;
  h ^= h >> 15u;
  return h;
}
// one hash per lattice corner, its bits split into the three components of the gradient
vec3 grad(ivec3 c) {
  uvec3 u = uvec3(c);
  uint h = mix32(u.x * 0x8da6b343u ^ u.y * 0xd8163841u ^ u.z * 0xcb1ab31fu);
  return vec3(uvec3(h, h >> 10u, h >> 20u) & 1023u) * (2.0 / 1023.0) - 1.0;
}
// value in about -1..1, then d/dx, d/dy, d/dz
vec4 gnoise(vec3 p) {
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
  return vec4(v * 1.6, g * 1.6);
}

// ---- the shape ------------------------------------------------------------------------------

// The stone in its own space: a smooth maximum of the planes, blended with a sphere for the
// bead. Both parts are convex, so the blend is too. Returns the field and its gradient.
float field(vec3 p, out vec3 g) {
  float r = max(length(p), 1e-6);
  float fs = r - u_shape.y;
  vec3 gs = p / r;
  if (u_shape.z <= 0.0) { g = gs; return fs; }
  // log-sum-exp taken relative to the sphere's value, which stays within about half a unit of
  // the largest plane anywhere the field is asked, so the exponentials never overflow
  float ik = 1.0 / u_shape.w;
  float sum = 0.0;
  vec3 gp = vec3(0.0);
  for (int i = 0; i < NP; i++) {
    float e = exp((dot(p, u_pl[i].xyz) - u_pl[i].w - fs) * ik);
    sum += e;
    gp += e * u_pl[i].xyz;
  }
  float fp = fs + u_shape.w * log(sum);
  g = mix(gs, gp / sum, u_shape.z);
  return mix(fs, fp, u_shape.z);
}

// the span of the ray where the field can be below e: inside the sphere or the sharp block,
// both grown by e (the field is a blend of two parts, each at least the sharp version of itself)
vec2 span(vec3 ro, vec3 rd, float e) {
  float b = dot(ro, rd);
  float R = u_shape.y + e;
  float c = dot(ro, ro) - R * R;
  float h = b * b - c;
  vec2 ts = h > 0.0 ? vec2(-b - sqrt(h), -b + sqrt(h)) : vec2(1e9, -1e9);
  if (u_shape.z <= 0.0) return ts;
  vec2 tp = vec2(-1e9, 1e9);
  for (int i = 0; i < NP; i++) {
    float dn = dot(u_pl[i].xyz, rd);
    float dist = u_pl[i].w + e - dot(u_pl[i].xyz, ro);
    if (abs(dn) < 1e-6) { if (dist < 0.0) tp = vec2(1e9, -1e9); }
    else if (dn > 0.0) tp.y = min(tp.y, dist / dn);
    else tp.x = max(tp.x, dist / dn);
  }
  if (u_shape.z >= 1.0) return tp;
  if (tp.x > tp.y) return ts;
  if (ts.x > ts.y) return tp;
  return vec2(min(ts.x, tp.x), max(ts.y, tp.y));
}

// ---- light ----------------------------------------------------------------------------------

float ggx(float ndh, float a) {
  float a2 = a * a;
  float d = ndh * ndh * (a2 - 1.0) + 1.0;
  return a2 / (3.14159 * d * d);
}
float vis(float ndl, float ndv, float a) {
  float k = a * 0.5;
  return 0.25 / ((ndl * (1.0 - k) + k) * (ndv * (1.0 - k) + k));
}

// a soft rectangle of light in direction c, half extents w (tangent of the angle), softness s
float softbox(vec3 r, vec3 c, vec3 up, vec2 w, float s) {
  float z = dot(r, c);
  if (z <= 0.05) return 0.0;
  vec3 x = normalize(cross(up, c));
  vec3 y = cross(c, x);
  vec2 q = abs(vec2(dot(r, x), dot(r, y)) / z);
  vec2 e = 1.0 - smoothstep(w - s, w + s, q);
  return e.x * e.y * smoothstep(0.05, 0.3, z);
}

// a dark studio with a big softbox up-left, a strip to the right and a faint one above
vec3 studio(vec3 r, float rough) {
  float s = 0.04 + rough * 0.45;
  vec3 c = mix(vec3(0.006, 0.005, 0.005), vec3(0.028, 0.027, 0.026), smoothstep(-0.5, 0.9, r.y));
  c += vec3(1.0, 0.94, 0.86) * 4.0 * softbox(r, normalize(vec3(-0.62, 0.55, 0.56)), vec3(0, 1, 0), vec2(0.5, 0.36), s);
  c += vec3(0.95, 0.95, 0.95) * 0.35 * softbox(r, normalize(vec3(0.9, 0.05, 0.25)), vec3(0, 1, 0), vec2(0.05, 0.9), s);
  c += vec3(1.0) * 0.2 * softbox(r, normalize(vec3(0.1, 1.0, -0.15)), vec3(0, 0, 1), vec2(0.7, 0.5), s * 1.5);
  return c;
}

// ---- the stone's colour ---------------------------------------------------------------------

// a thin line where x crosses zero, widened (and dimmed to keep its weight) once it is finer
// than the pixel's footprint fw, so it never breaks up
float vein(float x, float w, float fw) {
  float ww = max(w, fw * 1.2);
  return (1.0 - smoothstep(ww * 0.4, ww, abs(x))) * (w / ww);
}

// colour in rgb; in w, a slow change in the polish (a little duller here and there). fw is a
// pixel's footprint on the surface (worked out rather than taken from screen derivatives,
// which are not to be trusted next to pixels that have already returned)
vec4 albedo(vec3 q, float fw) {
  vec4 n1 = gnoise(q * 0.9 + vec3(3.1, 7.7, 1.3));
  vec3 wq = q + n1.yzw * 0.16;
  vec4 n2 = gnoise(wq * 1.9 + vec3(11.0, 2.0, 5.0));
  wq += n2.yzw * 0.05;
  // banding: layers of slightly different red, bent by the warp, irregular in width, with a
  // broad darker layer and a few thin lighter ones
  float ph = dot(wq, normalize(vec3(0.35, 1.0, 0.2))) * 7.0 + n2.x * 1.6;
  float layer = sin(ph) + 0.55 * sin(ph * 2.3 + 1.7 + n1.x * 2.0);
  float band = smoothstep(-0.45, 0.45, layer);
  float dark = smoothstep(0.65, 0.95, sin(ph * 0.37 + 0.8));
  float lift = 1.0 - smoothstep(-1.35, -0.95, layer);
  // a finer mottle, faded out well before it nears the size of a pixel
  vec3 fq = wq * 7.0 + vec3(0.0, 4.0, 0.0);
  float mott = gnoise(fq).x * (1.0 - smoothstep(0.12, 0.4, 7.0 * fw));
  float v = band * 0.24 + dark * 0.3 + (0.5 - 0.5 * n1.x) * 0.1 + mott * 0.08;
  vec3 deep = vec3(0.16, 0.003, 0.005);
  vec3 red = vec3(0.43, 0.0045, 0.006);
  vec3 a = mix(red, deep, clamp(v, -0.2, 1.0) * u_tex);
  a = mix(a, vec3(0.53, 0.01, 0.01), lift * 0.45 * u_tex);
  // a thin pale vein or two, nearly straight (a gentler warp, so they never close into rings),
  // each showing only along part of its length
  vec3 vq = q + n1.yzw * 0.05;
  float v1 = vein(dot(vq, normalize(vec3(0.8, -0.35, 0.5))) - 0.12 + n2.x * 0.03, 0.005, fw) * smoothstep(-0.3, 0.4, n1.x);
  float v2 = vein(dot(vq, normalize(vec3(-0.3, 0.45, 0.85))) + 0.38, 0.003, fw) * smoothstep(0.3, 0.7, n2.x);
  vec3 pale = vec3(0.48, 0.24, 0.2);
  a = mix(a, pale, clamp(v1 * 0.5 + v2 * 0.35, 0.0, 1.0) * u_tex);
  return vec4(a, n2.x * 0.5 + 0.5);
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

  // a pixel at the stone, in its own space (a little generous: the far side is smaller)
  float pxc = u_px / sc;
  vec2 tt = span(oro, ord, pxc * 1.5);
  if (tt.x > tt.y) { o = vec4(0.0); return; }

  // the surface: Newton steps from the entry side never overshoot a convex field
  vec3 g, gn;
  float t = tt.x, f = 1.0, sl = -1.0;
  for (int i = 0; i < 4; i++) {
    f = field(oro + ord * t, gn);
    sl = dot(gn, ord);
    t = min(t - f / min(sl, -1e-3), tt.y);
  }
  float px = pxc * t * sc / u_cam; // a pixel at that depth
  float cov = 1.0;
  // most rays: on the surface, and a short step on is already well inside, so fully covered
  bool inside = abs(f) < px * 0.05 && sl < -0.05 && field(oro + ord * (t + 2.0 * px / -sl), g) < -px;
  if (!inside) {
    // near the outline the closest approach gives the coverage; the field is convex along the
    // ray, so bisect its slope
    float lo = tt.x, hi = tt.y;
    for (int i = 0; i < 12; i++) {
      float tm = 0.5 * (lo + hi);
      field(oro + ord * tm, g);
      if (dot(g, ord) < 0.0) lo = tm; else hi = tm;
    }
    float ts = 0.5 * (lo + hi);
    float fmin = field(oro + ord * ts, g);
    px = pxc * ts * sc / u_cam;
    cov = clamp(0.5 - fmin / px, 0.0, 1.0);
    if (cov <= 0.0) { o = vec4(0.0); return; }
    // shade where the ray first comes within a hair of its closest approach (the surface itself
    // once it dips inside): the front of a face seen edge-on, as its covered neighbours see it,
    // rather than wherever along that face the bisection happened to settle
    float lvl = max(fmin + 0.1 * px, 0.0);
    t = tt.x;
    for (int i = 0; i < 6; i++) {
      float fi = field(oro + ord * t, g) - lvl;
      t = min(t - fi / min(dot(g, ord), -1e-3), ts);
    }
    field(oro + ord * t, gn);
  }
  vec3 p = oro + ord * t;
  vec3 n = normalize(gn);

  // a slow, shallow undulation, as on a hand-polished face
  vec4 nb = gnoise(p * 1.6 + vec3(5.0, 1.0, 9.0));
  vec3 bt = nb.yzw - dot(nb.yzw, n) * n;
  n = normalize(n - bt * 0.025 * u_shape.z);

  vec4 al = albedo(p, px / max(-dot(n, ord), 0.08));
  vec3 alb = al.rgb;

  vec3 P = u_rot * (p * sc);
  vec3 N = normalize(u_rot * n);
  vec3 V = normalize(ro - P);
  // in the last pixel or two of a rounded edge the normal swings round faster than one sample
  // per pixel can follow; tipping it a little towards the eye there keeps the outline's shading
  // from breaking into dots
  N = normalize(N + V * 0.3 * (1.0 - smoothstep(0.0, 0.45, dot(N, V))));
  float ndv = clamp(dot(N, V), 1e-3, 1.0);
  float rough = mix(0.34, 0.18 + 0.08 * al.w, u_shape.z);
  float a = rough * rough;

  // key: a soft light up-left, in front; a weak cool fill from the right; sky above, a dim
  // warm floor below
  vec3 Lk = normalize(vec3(-0.6, 0.62, 0.52));
  float dk = clamp((dot(N, Lk) + 0.12) / 1.12, 0.0, 1.0);
  vec3 Lf = normalize(vec3(0.85, -0.15, 0.5));
  float df = clamp((dot(N, Lf) + 0.2) / 1.2, 0.0, 1.0);
  float hemi = 0.5 + 0.5 * N.y;
  vec3 amb = mix(vec3(0.05, 0.04, 0.036), vec3(0.11, 0.11, 0.115), hemi);
  // rim: a light from behind, upper right, that only reaches faces turned well away from the
  // eye; it lights the stone's own red rather than laying a grey sheen over it
  vec3 Lr = normalize(vec3(0.55, 0.5, -0.67));
  float dr = smoothstep(0.0, 0.7, dot(N, Lr)) * (1.0 - smoothstep(0.2, 0.6, ndv));
  vec3 diff = vec3(1.0, 0.95, 0.88) * 1.3 * dk * dk + vec3(0.8, 0.86, 1.0) * 0.14 * df + amb + vec3(1.0, 0.9, 0.85) * 0.5 * dr;

  // polish: the studio in the surface, stronger at grazing angles
  float fr = pow(1.0 - ndv, 5.0);
  // (held below the physical peak, so grazing faces keep their red instead of going grey)
  float F = 0.045 + (0.5 - 0.045) * fr;
  vec3 R = reflect(-V, N);
  vec3 spec = studio(R, rough) * F;

  // the pointer's light: small, warm, close in front
  vec3 Lv = u_lp - P;
  float dl = length(Lv);
  vec3 Lp = Lv / dl;
  float nlp = max(dot(N, Lp), 0.0);
  vec3 Hp = normalize(Lp + V);
  float att = u_light / (1.0 + dl * dl * 0.18);
  float ap = 0.3 * 0.3;
  vec3 pc = vec3(1.0, 0.85, 0.68) * att;
  spec += pc * 1.8 * ggx(max(dot(N, Hp), 0.0), ap) * vis(nlp, ndv, ap) * nlp * (0.045 + 0.955 * pow(1.0 - max(dot(Hp, V), 0.0), 5.0));
  diff += pc * 0.6 * nlp;

  vec3 col = alb * diff * (1.0 - F) + spec;
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

// An even spread of directions, each nudged, a few cut deeper to leave broad faces; stretched a
// little so it reads as a stone rather than a die. Scaled so its farthest corner sits at REACH.
function stoneShape() {
  const r = rng(SEED);
  const aniso = [1.18, 0.84, 1.0];
  const pl: number[][] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < NP; i++) {
    const y = 1 - (2 * (i + 0.5)) / NP;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    const nx = Math.cos(th) * rad + (r() - 0.5) * 0.5;
    const ny = y + (r() - 0.5) * 0.4;
    const nz = Math.sin(th) * rad + (r() - 0.5) * 0.5;
    const deep = r() < 0.3;
    const w = deep ? 0.7 + r() * 0.08 : 0.8 + r() * 0.16;
    // the plane n.(p / aniso) = w, written as a unit normal in the stretched space
    let mx = nx / aniso[0];
    let my = ny / aniso[1];
    let mz = nz / aniso[2];
    const l = Math.hypot(mx, my, mz);
    mx /= l;
    my /= l;
    mz /= l;
    const ln = Math.hypot(nx, ny, nz);
    pl.push([mx, my, mz, w / ln / l]);
  }
  // the sharp block's corners, from every triple of planes; centred on their middle and scaled
  // so the farthest one sits at REACH
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
  pl.forEach((q, i) => {
    const w = (q[3] - q[0] * c[0] - q[1] * c[1] - q[2] * c[2]) * k;
    planes.set([q[0], q[1], q[2], w], i * 4);
    mean += w / NP;
  });
  return { planes, mean };
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

const UNIFORMS = ["u_res", "u_px", "u_cam", "u_rot", "u_pl", "u_shape", "u_tex", "u_lp", "u_light", "u_alpha"] as const;
type U = Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;

const nextFrame = () => new Promise<void>((res) => requestAnimationFrame(() => res()));

export class StoneRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private buf: WebGLBuffer;
  private U: U;
  private mean: number;
  private scale = 1;
  private disposed = false;

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext, prog: WebGLProgram, buf: WebGLBuffer, U: U, mean: number) {
    this.canvas = canvas;
    this.gl = gl;
    this.prog = prog;
    this.buf = buf;
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

      const buf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.useProgram(prog);
      const loc = gl.getAttribLocation(prog, "a_pos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const U = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(prog, n)])) as U;
      const shape = stoneShape();
      gl.uniform4fv(U.u_pl, shape.planes);
      gl.uniform1f(U.u_cam, CAM);
      gl.clearColor(0, 0, 0, 0);
      // one invisible draw now, so drivers that build the pipeline on first use (Safari) do it
      // here rather than on the first frame the stone is seen
      gl.viewport(0, 0, 1, 1);
      gl.uniform2f(U.u_res, 1, 1);
      gl.uniform1f(U.u_px, 3);
      gl.uniformMatrix3fv(U.u_rot, false, new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
      gl.uniform4f(U.u_shape, 1, shape.mean, 1, 0.05);
      gl.uniform1f(U.u_alpha, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (gl.isContextLost()) return null;
      return new StoneRenderer(canvas, gl, prog, buf, U, shape.mean);
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

    // the bead grows into the stone while its sphere gives way to the planes and their edges
    // tighten; all of it smooth in form, so scrolling never pops
    const form = Math.min(1, Math.max(0, f.form));
    const grow = smooth(0, 1, form);
    const s0 = BEAD / this.mean;
    const scale = s0 + (1 - s0) * grow;
    const toPlanes = PILLOW * smooth(0.05, 0.85, form);
    const soft = 0.022 + 0.3 * (1 - smooth(0.1, 1, form)) ** 2;
    gl.uniform4f(U.u_shape, scale, this.mean, toPlanes, soft);
    gl.uniform1f(U.u_tex, 0.15 + 0.85 * smooth(0.2, 0.9, form));

    const u = Math.max(1e-3, f.unit);
    gl.uniform2f(U.u_res, side, side);
    gl.uniform1f(U.u_px, f.size / side / u);
    gl.uniformMatrix3fv(U.u_rot, false, f.rot);
    gl.uniform3f(U.u_lp, (f.lightX - f.size / 2) / u, (f.size / 2 - f.lightY) / u, 1.8);
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
    gl.deleteBuffer(this.buf);
    gl.deleteProgram(this.prog);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
