import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/* ───────────────────────── tunables ───────────────────────── */

// size & placement
const TOMATO_HEIGHT_FRAC = 0.34; // whole tomato height / viewport height
const TOMATO_WIDTH_MAX_FRAC = 0.46; // ...but at most this share of viewport width
const TOMATO_Y_FRAC = 0.04; // centre sits this fraction of viewport height above middle
const CAMERA_Z = 6.4;
const CAMERA_FOV = 30;
const MAX_DPR = 1.75;
const EXPOSURE = 0.95;
const ENV_INTENSITY = 0.5;
const KEY_LIGHT_INTENSITY = 2.2;
const FILL_LIGHT_INTENSITY = 0.55;

// timeline windows (scroll progress p)
const SPIN_SPEED = 0.22; // rad/s
const FLOAT_AMP = 0.03; // local units
const IDLE_TILT_X = 0.26; // tilt towards camera while whole
const SNAP_START = 0.18; // yaw eases to nearest 2π multiple...
const SNAP_END = 0.3; // ...fully locked here
const CAPS_VISIBLE_FROM = 0.29;
const PART_START = 0.3;
const PART_END = 0.6;
const OUT_START = 0.52;
const OUT_END = 0.86;
const RENDER_UNTIL = 0.88; // canvas is invisible beyond this; stop rendering

// half motion (local units; 1 = tomato radius)
const PART_X = 0.95;
const OUT_X = 3.2;
const LEFT_TURN = -0.7; // rad about y, cut face towards camera (verified in render)
const RIGHT_TURN = 0.7;
const LEFT_TILT_Z = 0.06;
const RIGHT_TILT_Z = -0.06;
const OUT_EXTRA_TURN = 0.25; // extra turn while flying outward (same sign as turn)

// colours
const SKIN_BASE = "#b0160e";
const SKIN_SHOULDER = "#c43a16";
const SKIN_SHEEN = "#ff7350";
const INSIDE_FLESH: [number, number, number] = [0.84, 0.29, 0.2];
const SEPAL_COLOR = "#4f7a2e";
const STEM_COLOR = "#5d8a35";

// body shape
const FLATTEN_Y = 0.82;
const LOBE_AMP = 0.04;
const CAP_SCALE_Z = 0.955;
const CAP_SCALE_Y = 0.955 * FLATTEN_Y;

/* ───────────────────────── helpers ───────────────────────── */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const win = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** point on the tomato surface for polar angle (cosθ = ch), azimuth phi */
function surfacePoint(ch: number, phi: number, out = new THREE.Vector3()) {
  const sh = Math.sqrt(Math.max(0, 1 - ch * ch));
  let r = 1 + LOBE_AMP * Math.cos(6 * phi) * (1 - ch * ch);
  const dx = sh * Math.cos(phi);
  const dz = sh * Math.sin(phi);
  r *= 1 + 0.008 * Math.sin(2.3 * dx + 1.7 * ch) * Math.cos(1.9 * dz - 0.8 * ch);
  let y = ch * FLATTEN_Y;
  y -= 0.09 * Math.pow(smoothstep(0.72, 1, ch), 1.5); // stem dimple
  y += 0.04 * smoothstep(0.7, 1, -ch); // flattened bottom
  return out.set(dx * r, y, dz * r);
}

function buildBody() {
  let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, 160, 120);
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i);
    const dy = pos.getY(i);
    const dz = pos.getZ(i);
    surfacePoint(dy, Math.atan2(dz, dx), v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g = mergeVertices(g, 1e-5);
  const p2 = g.getAttribute("position") as THREE.BufferAttribute;
  const base = new THREE.Color(SKIN_BASE);
  const top = new THREE.Color(SKIN_SHOULDER);
  const col = new Float32Array(p2.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p2.count; i++) {
    const y = p2.getY(i) / FLATTEN_Y;
    const mottling = 0.5 + 0.5 * Math.sin(p2.getX(i) * 5.1 + p2.getZ(i) * 3.7 + y * 4.3);
    c.copy(base).lerp(top, smoothstep(0.35, 1, y) * 0.8 + mottling * 0.08);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function buildSepal(az: number, twist: number) {
  const N = 10;
  const L = 0.48;
  const W = 0.11;
  const theta0 = 0.09;
  const centres: THREE.Vector3[] = [];
  const tmp = new THREE.Vector3();
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const th = theta0 + t * L;
    surfacePoint(Math.cos(th), az, tmp);
    tmp.multiplyScalar(1.025);
    tmp.y += 0.015 + Math.pow(t, 3) * 0.13; // tips curl up
    centres.push(tmp.clone());
  }
  const verts: number[] = [];
  const idx: number[] = [];
  const tan = new THREE.Vector3();
  const perp = new THREE.Vector3();
  const up = new THREE.Vector3();
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    tan.copy(centres[Math.min(N, i + 1)]).sub(centres[Math.max(0, i - 1)]).normalize();
    perp.set(-Math.sin(az), 0, Math.cos(az));
    perp.applyAxisAngle(tan, twist * t);
    up.crossVectors(perp, tan).normalize();
    if (up.y < 0) up.negate();
    const w = (W / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, 0.25 + 0.75 * t)), 0.9) * 1.4;
    const c = centres[i];
    verts.push(
      c.x - perp.x * w - up.x * 0.012, c.y - perp.y * w - up.y * 0.012, c.z - perp.z * w - up.z * 0.012,
      c.x + up.x * 0.012, c.y + up.y * 0.012, c.z + up.z * 0.012,
      c.x + perp.x * w - up.x * 0.012, c.y + perp.y * w - up.y * 0.012, c.z + perp.z * w - up.z * 0.012,
    );
    if (i < N) {
      const a = i * 3;
      const b = (i + 1) * 3;
      idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildStem() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.68, 0),
    new THREE.Vector3(0, 0.78, 0.01),
    new THREE.Vector3(0, 0.89, 0.04),
    new THREE.Vector3(0, 0.96, 0.095),
  ]);
  return new THREE.TubeGeometry(curve, 16, 0.035, 10, false);
}

type Pt = [number, number];

/** closed smooth organic path through points (midpoint quadratic smoothing) */
function smoothClosedPath(ctx: CanvasRenderingContext2D, p: Pt[]) {
  const n = p.length;
  ctx.beginPath();
  ctx.moveTo((p[n - 1][0] + p[0][0]) / 2, (p[n - 1][1] + p[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const a = p[i];
    const b = p[(i + 1) % n];
    ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  ctx.closePath();
}

/** perturbed polar curve: radius(a) = base * (1 + sum of random sines) */
function noisyRing(rnd: () => number, base: number, amp: number, steps: number): Pt[] {
  const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  const out: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const k =
      Math.sin(2 * a + ph[0]) * 0.5 + Math.sin(3 * a + ph[1]) * 0.35 + Math.sin(5 * a + ph[2]) * 0.2 +
      Math.sin(9 * a + ph[3]) * 0.1 + (rnd() - 0.5) * 0.12;
    const r = base * (1 + amp * k);
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
}

function drawTeardrop(ctx: CanvasRenderingContext2D, len: number, wid: number) {
  // tip at (0,-len) (pointing toward the centre after rotation), round end at +len
  ctx.beginPath();
  ctx.moveTo(0, -len);
  ctx.bezierCurveTo(wid * 0.9, -len * 0.4, wid * 1.1, len * 0.7, 0, len);
  ctx.bezierCurveTo(-wid * 1.1, len * 0.7, -wid * 0.9, -len * 0.4, 0, -len);
  ctx.closePath();
}

function drawCutFace(): HTMLCanvasElement {
  const S = 1024;
  const R = S / 2;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const ctx = cv.getContext("2d")!;
  const rnd = mulberry32(7);
  ctx.translate(R, R);
  const TAU = Math.PI * 2;

  // 1. skin rim (slightly irregular), deep red-orange
  smoothClosedPath(ctx, noisyRing(rnd, R * 0.99, 0.008, 48));
  let g: CanvasGradient = ctx.createRadialGradient(0, 0, R * 0.8, 0, 0, R);
  g.addColorStop(0, "#e8502a");
  g.addColorStop(0.9, "#d9381c");
  g.addColorStop(1, "#c42a14");
  ctx.fillStyle = g;
  ctx.fill();

  // 2. pericarp: inner flesh gradient, pale pink inside -> saturated red-orange outside
  const wallR = R * 0.955;
  ctx.save();
  smoothClosedPath(ctx, noisyRing(rnd, wallR, 0.012, 48));
  g = ctx.createRadialGradient(0, 0, 0, 0, 0, wallR);
  g.addColorStop(0, "#f6d2bf");
  g.addColorStop(0.35, "#f2bda5");
  g.addColorStop(0.6, "#f0a385");
  g.addColorStop(0.76, "#f08a64");
  g.addColorStop(0.88, "#f0643a");
  g.addColorStop(1, "#e8502a");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();

  // translucent paler speckled band just inside the saturated rim
  ctx.save();
  ctx.filter = "blur(10px)";
  ctx.strokeStyle = "rgba(250,205,180,0.4)";
  ctx.lineWidth = R * 0.07;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.8, 0, TAU);
  ctx.stroke();
  ctx.restore();
  for (let i = 0; i < 2600; i++) {
    const a = rnd() * TAU;
    const r = R * (0.7 + 0.2 * rnd() * rnd() + 0.05 * rnd());
    const sz = 0.8 + rnd() * 2.6;
    ctx.fillStyle = `rgba(${247 + Math.floor(rnd() * 8)},${201 + Math.floor(rnd() * 30)},${176 + Math.floor(rnd() * 30)},${0.1 + rnd() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r, sz * 1.3, sz, a, 0, TAU);
    ctx.fill();
  }
  // faint radial cell streaks in the wall
  for (let i = 0; i < 220; i++) {
    const a = rnd() * TAU;
    const r0 = R * (0.55 + rnd() * 0.3);
    const r1 = r0 + R * (0.05 + rnd() * 0.12);
    ctx.strokeStyle = `rgba(255,225,205,${0.04 + rnd() * 0.08})`;
    ctx.lineWidth = 1 + rnd() * 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.stroke();
  }

  // 3. placenta: cross with 4 broad arms
  const rot = Math.PI / 4 + (rnd() - 0.5) * 0.25;
  const armA: number[] = [];
  for (let k = 0; k < 4; k++) armA.push(rot + (k * TAU) / 4 + (rnd() - 0.5) * 0.3);
  const armLen = [0.62, 0.58, 0.64, 0.56].map((v) => R * (v + (rnd() - 0.5) * 0.06));
  const armW = [0.17, 0.2, 0.15, 0.19].map((v) => R * v);
  ctx.save();
  ctx.filter = "blur(9px)";
  for (let k = 0; k < 4; k++) {
    ctx.save();
    ctx.rotate(armA[k]);
    const w = armW[k];
    const L = armLen[k];
    g = ctx.createLinearGradient(0, 0, L, 0);
    g.addColorStop(0, "#f4d9c8");
    g.addColorStop(0.4, "#f0e3b8");
    g.addColorStop(0.75, "#e6eab0");
    g.addColorStop(1, "rgba(240,200,170,0.7)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.5);
    ctx.bezierCurveTo(L * 0.3, -w * 0.4, L * 0.6, -w * 0.5, L, -w * 0.9);
    ctx.lineTo(L, w * 0.9);
    ctx.bezierCurveTo(L * 0.6, w * 0.5, L * 0.3, w * 0.4, 0, w * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.3);
  g.addColorStop(0, "#f4d9c8");
  g.addColorStop(0.6, "#f2dcc0");
  g.addColorStop(1, "rgba(242,200,175,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.3, 0, TAU);
  ctx.fill();
  ctx.restore();
  // greenish-yellow vein cores along the arms + fibrous streaks
  for (let k = 0; k < 4; k++) {
    for (let j = 0; j < 40; j++) {
      const a = armA[k] + (rnd() - 0.5) * 0.28;
      const r0 = R * (0.05 + rnd() * 0.15);
      const r1 = r0 + R * (0.12 + rnd() * 0.25);
      ctx.strokeStyle = rnd() < 0.5 ? `rgba(230,234,176,${0.15 + rnd() * 0.25})` : `rgba(255,245,225,${0.15 + rnd() * 0.25})`;
      ctx.lineWidth = 1 + rnd() * 2.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a + (rnd() - 0.5) * 0.04) * r1, Math.sin(a + (rnd() - 0.5) * 0.04) * r1);
      ctx.stroke();
    }
  }

  // 4. locules between the arms (irregular), 4 + a small 5th
  const nLoc = 5;
  const spans: [number, number][] = [];
  for (let k = 0; k < 4; k++) {
    const a0 = armA[k];
    let a1 = armA[(k + 1) % 4];
    if (a1 <= a0) a1 += TAU;
    spans.push([a0, a1]);
  }
  for (let k = 0; k < nLoc; k++) {
    let c: number;
    let hw: number;
    let outer: number;
    let inner: number;
    if (k < 4) {
      const [a0, a1] = spans[k];
      c = (a0 + a1) / 2 + (rnd() - 0.5) * 0.12;
      hw = (a1 - a0) / 2 - 0.2 - rnd() * 0.08;
      outer = R * (0.66 + rnd() * 0.07);
      inner = R * (0.27 + rnd() * 0.09);
    } else {
      // small extra chamber, tucked on the widest gap's outer wall
      const [a0, a1] = spans[Math.floor(rnd() * 4)];
      c = (a0 + a1) / 2 + 0.05;
      hw = 0.1;
      outer = R * 0.63;
      inner = R * 0.5;
    }
    const pts: Pt[] = [];
    const steps = 14;
    const pOut = [rnd() * 6.28, rnd() * 6.28];
    const pIn = [rnd() * 6.28, rnd() * 6.28];
    // outer arc (wide, bulging), then inner arc back (pinched toward the placenta)
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const a = c - hw + 2 * hw * u;
      const edge = Math.sin(u * Math.PI);
      const r = outer * (0.78 + 0.22 * Math.pow(edge, 0.5)) * (1 + 0.04 * Math.sin(u * 9 + pOut[0]) + 0.03 * Math.sin(u * 17 + pOut[1]));
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    for (let i = steps; i >= 0; i--) {
      const u = i / steps;
      const a = c - hw * 0.92 + 2 * hw * 0.92 * u;
      const edge = Math.sin(u * Math.PI);
      const r = inner + (outer - inner) * 0.25 * (1 - Math.pow(edge, 0.7)) + R * 0.03 * Math.sin(u * 8 + pIn[0]) + R * 0.015 * Math.sin(u * 15 + pIn[1]);
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const ux = Math.cos(c);
    const uy = Math.sin(c);
    // soft pale rim around the locule (cell-wall glow)
    ctx.save();
    ctx.filter = "blur(6px)";
    smoothClosedPath(ctx, pts);
    ctx.fillStyle = "rgba(235,120,80,0.6)";
    ctx.lineWidth = 14;
    ctx.strokeStyle = "rgba(245,170,130,0.55)";
    ctx.stroke();
    ctx.fill();
    ctx.restore();

    // jelly fill
    ctx.save();
    smoothClosedPath(ctx, pts);
    ctx.clip();
    g = ctx.createLinearGradient(ux * inner, uy * inner, ux * outer, uy * outer);
    g.addColorStop(0, "#d8381a");
    g.addColorStop(0.5, "#c42a14");
    g.addColorStop(1, "#b51d10");
    ctx.fillStyle = g;
    ctx.fillRect(-R, -R, S, S);
    // orange translucent glow near the placenta side
    ctx.save();
    ctx.filter = "blur(18px)";
    g = ctx.createRadialGradient(ux * inner, uy * inner, 0, ux * inner, uy * inner, R * 0.22);
    g.addColorStop(0, "rgba(240,140,60,0.7)");
    g.addColorStop(1, "rgba(240,140,60,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-R, -R, S, S);
    ctx.restore();
    // darker pockets
    ctx.save();
    ctx.filter = "blur(14px)";
    ctx.globalCompositeOperation = "multiply";
    for (let i = 0; i < 6; i++) {
      const a = c + (rnd() - 0.5) * 2 * hw * 0.8;
      const r = inner + (outer - inner) * (0.45 + rnd() * 0.5);
      ctx.fillStyle = `rgba(143,18,8,${0.35 + rnd() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r, R * (0.03 + rnd() * 0.04), R * (0.025 + rnd() * 0.03), a, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // seeds along the inner edge, tips pointing toward the centre
    const nSeeds = 6 + Math.floor(rnd() * 8) - (k === 4 ? 4 : 0);
    const seedList: { x: number; y: number; rt: number; l: number; w: number }[] = [];
    for (let i = 0; i < nSeeds; i++) {
      const u = (i + 0.5) / nSeeds;
      const a = c - hw * 0.82 + 2 * hw * 0.82 * u + (rnd() - 0.5) * 0.05;
      const edge = Math.sin(u * Math.PI);
      const rIn = inner + (outer - inner) * 0.25 * (1 - Math.pow(edge, 0.7));
      const r = rIn + R * (0.05 + 0.05 * rnd());
      const sc = k === 4 ? 0.7 : 1;
      seedList.push({
        x: Math.cos(a) * r,
        y: Math.sin(a) * r,
        rt: a + Math.PI / 2 + Math.PI + (rnd() - 0.5) * 0.9,
        l: R * (0.032 + rnd() * 0.014) * sc,
        w: R * (0.017 + rnd() * 0.006) * sc,
      });
    }
    // gel halos
    ctx.save();
    ctx.filter = "blur(5px)";
    for (const s of seedList) {
      ctx.fillStyle = "rgba(245,150,80,0.5)";
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.w * 2.2, s.l * 1.5, s.rt, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    for (const s of seedList) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rt);
      drawTeardrop(ctx, s.l, s.w);
      g = ctx.createLinearGradient(-s.w, -s.l, s.w, s.l);
      g.addColorStop(0, "#f2d48a");
      g.addColorStop(1, "#e9c070");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(190,110,40,0.45)";
      ctx.stroke();
      ctx.fillStyle = "rgba(255,248,215,0.55)";
      ctx.beginPath();
      ctx.ellipse(-s.w * 0.3, -s.l * 0.15, s.w * 0.25, s.l * 0.4, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // glossy wet highlights along the outer/one side
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineCap = "round";
    const hs = c + hw * (rnd() < 0.5 ? -0.55 : 0.55);
    for (let i = 0; i < 3; i++) {
      const a0 = hs + (rnd() - 0.5) * hw * 0.5;
      const r0 = outer * (0.72 + rnd() * 0.2);
      const len = 0.08 + rnd() * 0.12;
      ctx.strokeStyle = `rgba(255,240,235,${0.5 + rnd() * 0.3})`;
      ctx.lineWidth = 2 + rnd() * 3;
      ctx.filter = "blur(1.5px)";
      ctx.beginPath();
      ctx.arc(0, 0, r0, a0, a0 + len);
      ctx.stroke();
    }
    ctx.filter = "blur(8px)";
    ctx.fillStyle = "rgba(255,170,150,0.25)";
    ctx.beginPath();
    ctx.ellipse(Math.cos(hs) * outer * 0.8, Math.sin(hs) * outer * 0.8, R * 0.08, R * 0.035, hs + Math.PI / 2, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.restore(); // clip
  }

  ctx.restore(); // wall clip

  // 6. overall lighting: brighter centre, deeper skin edge, no outlines
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.99, 0, TAU);
  ctx.clip();
  ctx.globalCompositeOperation = "screen";
  g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.8);
  g.addColorStop(0, "rgba(255,225,200,0.16)");
  g.addColorStop(1, "rgba(255,225,200,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-R, -R, S, S);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  g = ctx.createRadialGradient(0, 0, R * 0.88, 0, 0, R);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(215,150,140,1)");
  ctx.fillStyle = g;
  ctx.fillRect(-R, -R, S, S);
  ctx.restore();
  ctx.restore();
  return cv;
}

/* ───────────────────────── scene ───────────────────────── */

export function createTomatoScene(canvas: HTMLCanvasElement): {
  setProgress(p: number): void;
  dispose(): void;
} {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = EXPOSURE;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 50);
  camera.position.set(0, 0, CAMERA_Z);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const envRT = pmrem.fromScene(envScene, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = ENV_INTENSITY;
  envScene.dispose();

  const key = new THREE.DirectionalLight(0xffffff, KEY_LIGHT_INTENSITY);
  key.position.set(-3, 4, 5);
  const fill = new THREE.DirectionalLight(0xffc9a0, FILL_LIGHT_INTENSITY);
  fill.position.set(4, 0.5, 2.5);
  scene.add(key, fill);

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const bodyGeo = buildBody();
  const sepalGeos = Array.from({ length: 6 }, (_, i) => buildSepal((i * Math.PI) / 3 + Math.PI / 6, 0.5 * (i % 2 ? 1 : -1)));
  const stemGeo = buildStem();
  const capGeoR = new THREE.CircleGeometry(1, 128).scale(CAP_SCALE_Z, CAP_SCALE_Y, 1).rotateY(Math.PI / 2);
  const capGeoL = new THREE.CircleGeometry(1, 128).scale(CAP_SCALE_Z, CAP_SCALE_Y, 1).rotateY(-Math.PI / 2);
  geometries.push(bodyGeo, ...sepalGeos, stemGeo, capGeoR, capGeoL);

  const capTex = new THREE.CanvasTexture(drawCutFace());
  capTex.colorSpace = THREE.SRGBColorSpace;
  capTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  textures.push(capTex);

  const root = new THREE.Group();
  scene.add(root);

  const makeHalf = (side: 1 | -1) => {
    const plane = new THREE.Plane(new THREE.Vector3(side, 0, 0), 0);
    const skin = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      sheen: 0.12,
      sheenColor: new THREE.Color(SKIN_SHEEN),
      side: THREE.DoubleSide,
      clippingPlanes: [plane],
    });
    skin.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        if (!gl_FrontFacing) diffuseColor.rgb = vec3(${INSIDE_FLESH.map((n) => n.toFixed(3)).join(", ")});`,
      );
    };
    const sepalMat = new THREE.MeshStandardMaterial({ color: SEPAL_COLOR, roughness: 0.6, side: THREE.DoubleSide, clippingPlanes: [plane] });
    const stemMat = new THREE.MeshStandardMaterial({ color: STEM_COLOR, roughness: 0.6, side: THREE.DoubleSide, clippingPlanes: [plane] });
    // the flat cut face would mirror the studio environment and wash the cross-section out,
    // so it reflects far less of it than the skin: moist, not glassy
    const capMat = new THREE.MeshPhysicalMaterial({
      map: capTex,
      roughness: 0.62,
      clearcoat: 0.2,
      clearcoatRoughness: 0.45,
      envMapIntensity: 0.25,
    });
    materials.push(skin, sepalMat, stemMat, capMat);

    const group = new THREE.Group();
    group.add(new THREE.Mesh(bodyGeo, skin));
    sepalGeos.forEach((sg) => group.add(new THREE.Mesh(sg, sepalMat)));
    group.add(new THREE.Mesh(stemGeo, stemMat));
    // the cut face is on the inside of each half: the right half (keeps +x) is cut along its
    // left side, so its disc faces −x, and vice versa
    const cap = new THREE.Mesh(side === 1 ? capGeoL : capGeoR, capMat);
    cap.visible = false;
    group.add(cap);
    root.add(group);
    return { group, plane, cap, localNormal: new THREE.Vector3(side, 0, 0) };
  };
  const right = makeHalf(1);
  const left = makeHalf(-1);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let progress = 0;
  let yaw = 0;
  let time = 0;
  let last = performance.now();
  let scale = 0.7;
  let viewH = 1;

  const wPos = new THREE.Vector3();
  const wQuat = new THREE.Quaternion();
  const wScl = new THREE.Vector3();
  const nrm = new THREE.Vector3();

  const syncPlane = (h: typeof right) => {
    h.group.matrixWorld.decompose(wPos, wQuat, wScl);
    nrm.copy(h.localNormal).applyQuaternion(wQuat);
    h.plane.setFromNormalAndCoplanarPoint(nrm, wPos);
  };

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    viewH = 2 * CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2));
    const viewW = viewH * camera.aspect;
    scale = Math.min((TOMATO_HEIGHT_FRAC * viewH) / (2 * FLATTEN_Y), (TOMATO_WIDTH_MAX_FRAC * viewW) / 2);
    const cyPx = h * (0.5 - TOMATO_Y_FRAC);
    const hPx = ((2 * FLATTEN_Y * scale) / viewH) * h;
    const host = canvas.parentElement;
    if (host) {
      host.style.setProperty("--tm-cy", `${cyPx.toFixed(1)}px`);
      host.style.setProperty("--tm-h", `${hPx.toFixed(1)}px`);
    }
  };
  const ro = new ResizeObserver(() => {
    resize();
    render(0);
  });
  ro.observe(canvas);
  resize();

  function render(dt: number) {
    const p = progress;
    if (p > RENDER_UNTIL) return;
    time += dt;

    // yaw: idle spin, then eases to the nearest whole turn so the cut plane is edge-on
    const snap = win(p, SNAP_START, SNAP_END);
    if (!reduceMotion && snap < 1) yaw += SPIN_SPEED * dt * (1 - snap);
    if (reduceMotion && snap === 0) yaw = 0;
    if (snap > 0) {
      const target = Math.round(yaw / (Math.PI * 2)) * Math.PI * 2;
      yaw = snap >= 1 ? target : yaw + (target - yaw) * (1 - Math.exp(-dt * 10 * snap));
    }
    const floatY = reduceMotion ? 0 : Math.sin(time * 1.1) * FLOAT_AMP * (1 - snap);

    root.scale.setScalar(scale);
    root.position.y = TOMATO_Y_FRAC * viewH + floatY * scale;
    root.rotation.y = yaw;
    root.rotation.x = IDLE_TILT_X * (1 - snap);

    const part = easeInOutCubic(win(p, PART_START, PART_END));
    const out = easeInOutCubic(win(p, OUT_START, OUT_END));
    const dx = PART_X * part + (OUT_X - PART_X) * out;
    const turn = part + OUT_EXTRA_TURN * out;

    left.group.position.x = -dx;
    left.group.rotation.set(0, LEFT_TURN * turn, LEFT_TILT_Z * part);
    right.group.position.x = dx;
    right.group.rotation.set(0, RIGHT_TURN * turn, RIGHT_TILT_Z * part);
    const showCaps = p > CAPS_VISIBLE_FROM;
    left.cap.visible = right.cap.visible = showCaps;

    root.updateMatrixWorld(true);
    syncPlane(left);
    syncPlane(right);
    renderer.render(scene, camera);
  }

  return {
    setProgress(p: number) {
      progress = clamp01(p);
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      render(dt);
    },
    dispose() {
      ro.disconnect();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
