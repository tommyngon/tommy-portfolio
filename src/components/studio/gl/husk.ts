// Offscreen "live picture" of the Huskelappen sheet, for another renderer to upload as a
// texture each frame. The app's mark, four translucent rounded diamonds, built as thin
// sheets of coloured glass: parallel, turned a little towards the light, standing in a row
// that recedes to the right. At rest they line up into the flat logo (tops level, each one a
// touch smaller than the one before); hover() opens the gaps between them, so the depth
// shows. The wordmark is the sheet's `mark` layer.
import { HANDHELD_SCALE, handheld } from "./handheld";
import type { LiveSource } from "./seam";

const SHEET_W = 1200;
const BG = "#cedcf5"; // the app's light blue

// Sheet units (the still is 1200 x 1500). The logo's silhouette at rest is centred here.
const LOGO_X = 600;
const LOGO_Y = 681;

// Pinhole camera: a point (X, Y, Z) lands at (EYE_X + F X / Z, EYE_Y + F Y / Z), so depth
// Z = F is life size. The eye is level with the cards' top corners, which therefore stay on
// one line however far apart the cards are.
const F = 1400;
const EYE_X = LOGO_X;

// One card: a square with rounded corners turned 45 degrees into a diamond, its face turned
// TILT radians towards the upper left about an axis rising AXIS radians to the right. That
// is the logo's lean: a touch wider than tall, the top corner right of centre.
const HALF = 58; // centre to a (sharp) corner, in the card's plane
const ROUND = 5.5; // corner radius
const TILT = 0.56;
const AXIS = -0.49;
const THICK = 5; // seen as a thin edge along the lower right sides

// The row: card i (0 = blue, at the front) is centred on MID + (i - 1.5) * spread * STEP.
const STEP_X = 24.5;
const STEP_Z = 52;
const MID_Z = F;
const SPREAD = 1.7; // the gaps on hover, relative to rest

// The paper behind the row takes a soft shadow from each card, falling down and to the
// right; the further a card stands from the paper, the further and softer its shadow.
const PAPER_Z = F + 260;
const SHADOW_DX = 0.016; // shadow offset per unit of distance to the paper
const SHADOW_DY = 0.05;
const SHADOW_BLUR = 9; // sheet units
const SHADOW_INK = "rgba(52, 66, 140, 1)";

// Where two sheets overlap the logo is denser than one sheet simply laid over another:
// half of each sheet's colour is laid over, half added (order-free, like light).
const MIX = 0.5;

const MOVE = 0.6; // seconds to spread or settle
const MIN_FRAME = 1 / 90; // on high refresh screens, re-upload about every other frame

type Pt = readonly [number, number];
type Stop = readonly [number, string];
type Look = {
  from: Pt; // gradient across the face, in the card's own plane (x right, y down)
  to: Pt;
  stops: readonly Stop[];
  edge: string; // the sheet seen edge-on: the same glass, denser
  shadow: number; // opacity of its shadow
};

// Colours and opacities sampled from the app's mark (public/logo-mark.png), left to right.
// Each sheet but the first fades in from its left corner, which lies over its neighbour.
const LOOKS: readonly Look[] = [
  {
    from: [-HALF, 0],
    to: [HALF * 0.35, HALF * 0.8],
    stops: [
      [0, "rgba(40, 120, 245, 0.25)"],
      [0.4, "rgba(8, 0, 236, 0.32)"],
      [1, "rgba(96, 0, 229, 0.3)"],
    ],
    edge: "rgba(40, 20, 210, 0.42)",
    shadow: 0.2,
  },
  {
    from: [-HALF, 0],
    to: [HALF, 0],
    stops: [
      [0, "rgba(225, 0, 214, 0.08)"],
      [0.4, "rgba(232, 0, 212, 0.4)"],
      [1, "rgba(228, 0, 213, 0.42)"],
    ],
    edge: "rgba(170, 0, 170, 0.4)",
    shadow: 0.18,
  },
  {
    from: [-HALF, 0],
    to: [HALF, 0],
    stops: [
      [0, "rgba(250, 30, 0, 0.08)"],
      [0.5, "rgba(252, 38, 0, 0.36)"],
      [1, "rgba(248, 24, 0, 0.38)"],
    ],
    edge: "rgba(210, 30, 0, 0.38)",
    shadow: 0.16,
  },
  {
    from: [-HALF, 0],
    to: [HALF, 0],
    stops: [
      [0, "rgba(252, 150, 8, 0)"],
      [0.3, "rgba(252, 160, 8, 0.2)"],
      [0.55, "rgba(252, 172, 8, 0.49)"],
      [1, "rgba(253, 190, 20, 0.66)"],
    ],
    edge: "rgba(235, 150, 0, 0.48)",
    shadow: 0.13,
  },
];

// The card's plane on screen (weak perspective: each card is this map, scaled by F / Z),
// and the normal that points from its face into the screen.
const ax = Math.cos(AXIS), ay = Math.sin(AXIS), cT = Math.cos(TILT), sT = Math.sin(TILT);
const A11 = cT + (1 - cT) * ax * ax, A12 = (1 - cT) * ax * ay, A21 = A12, A22 = cT + (1 - cT) * ay * ay;
const NX = -ay * sT, NY = ax * sT, NZ = cT;
const project = ([x, y]: Pt): Pt => [A11 * x + A12 * y, A21 * x + A22 * y];

// The outline as a polygon (clockwise on screen), fine enough to build the edge from.
function outline(half: number, round: number, steps = 10): Pt[] {
  const pts: Pt[] = [];
  const reach = half - round * Math.SQRT2;
  for (const corner of [-0.5, 0, 0.5, 1]) {
    const phi = corner * Math.PI;
    for (let j = 0; j <= steps; j++) {
      const th = phi - Math.PI / 4 + (j / steps) * (Math.PI / 2);
      pts.push([reach * Math.cos(phi) + round * Math.cos(th), reach * Math.sin(phi) + round * Math.sin(th)]);
    }
  }
  return pts;
}

const OUTLINE = outline(HALF, ROUND);
const SCREEN = OUTLINE.map(project);
const TOP = -Math.min(...SCREEN.map((p) => p[1])); // centre to top corner, on screen
const BOTTOM = Math.max(...SCREEN.map((p) => p[1]));
const LEFT = -Math.min(...SCREEN.map((p) => p[0]));
const RIGHT = Math.max(...SCREEN.map((p) => p[0]));

// Rest layout: the cards' centres hang TOP below the eye, so every top corner is at eye level.
const depth = (i: number, spread: number) => MID_Z + (i - 1.5) * spread * STEP_Z;
const S0 = F / depth(0, 1), S3 = F / depth(3, 1);
const MID_X = -(S3 * (RIGHT + 1.5 * STEP_X) - S0 * (LEFT + 1.5 * STEP_X)) / (S0 + S3);
const EYE_Y = LOGO_Y - (S0 * (TOP + BOTTOM)) / 2;

// Back face offset on screen, taken back into the card's plane: the visible edge is the
// part of the back face that the front face does not cover.
const EDGE: Pt = (() => {
  const ox = THICK * NX, oy = THICK * (NY - (TOP / F) * NZ);
  const det = A11 * A22 - A12 * A21;
  return [(A22 * ox - A12 * oy) / det, (-A21 * ox + A11 * oy) / det];
})();

// Where the cards can be, at rest and spread, with room for their edges (sheet units).
const GLASS = (() => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const spread of [1, SPREAD])
    for (let i = 0; i < 4; i++) {
      const s = F / depth(i, spread);
      const x = EYE_X + s * (MID_X + (i - 1.5) * spread * STEP_X), y = EYE_Y + s * TOP;
      x0 = Math.min(x0, x - s * LEFT);
      x1 = Math.max(x1, x + s * RIGHT);
      y0 = Math.min(y0, y - s * TOP);
      y1 = Math.max(y1, y + s * BOTTOM);
    }
  return { x: x0 - 8, y: y0 - 8, w: x1 - x0 + 16, h: y1 - y0 + 16 };
})();

function edgePath(): Path2D {
  const n = OUTLINE.length;
  const facing = (i: number) => {
    const [px, py] = OUTLINE[i], [qx, qy] = OUTLINE[(i + 1) % n];
    const nx = qy - py, ny = px - qx; // outward for a clockwise outline (y down)
    return nx * EDGE[0] + ny * EDGE[1] > 0;
  };
  let start = 0;
  while (!(facing(start) && !facing((start + n - 1) % n))) start = (start + 1) % n;
  const chain: Pt[] = [];
  for (let i = start; ; i = (i + 1) % n) {
    chain.push(OUTLINE[i]);
    if (!facing(i)) break;
  }
  const path = new Path2D();
  chain.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  for (let i = chain.length - 1; i >= 0; i--) path.lineTo(chain[i][0] + EDGE[0], chain[i][1] + EDGE[1]);
  path.closePath();
  return path;
}

function facePath(half: number, round: number): Path2D {
  const path = new Path2D();
  const reach = half - round * Math.SQRT2;
  for (const corner of [-0.5, 0, 0.5, 1]) {
    const phi = corner * Math.PI;
    path.arc(reach * Math.cos(phi), reach * Math.sin(phi), round, phi - Math.PI / 4, phi + Math.PI / 4);
  }
  path.closePath();
  return path;
}

// Everything but the card (with the even-odd rule), to keep its shadow off it.
function outsidePath(face: Path2D): Path2D {
  const path = new Path2D();
  path.rect(-50 * HALF, -50 * HALF, 100 * HALF, 100 * HALF);
  path.addPath(face);
  return path;
}

// The upper left side, which faces the light: a fine highlight just inside the edge.
function rimPath(): Path2D {
  const w = 0.7;
  const half = HALF - w * Math.SQRT2, round = ROUND - w;
  const reach = half - round * Math.SQRT2;
  const path = new Path2D();
  path.arc(-reach, 0, round, Math.PI, Math.PI * 1.25);
  path.arc(0, -reach, round, -Math.PI * 0.75, -Math.PI * 0.5);
  return path;
}

const easeState = (from: number, vel: number, to: number, dur: number, u: number): [number, number] => {
  // cubic Hermite from (from, vel) to (to, 0): no jump in place or speed when interrupted
  const u2 = u * u, u3 = u2 * u;
  const p = (2 * u3 - 3 * u2 + 1) * from + (u3 - 2 * u2 + u) * dur * vel + (3 * u2 - 2 * u3) * to;
  const v = ((6 * u2 - 6 * u) * from + (3 * u2 - 4 * u + 1) * dur * vel + (6 * u - 6 * u2) * to) / dur;
  return [p, v];
};

export class HuskSource implements LiveSource {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private disposed = false;
  private first = true;
  private last = -1;
  private drawn = -1;

  private face = facePath(HALF, ROUND);
  private outside = outsidePath(this.face);
  private edge = edgePath();
  private rim = rimPath();
  private glass: CanvasRenderingContext2D | null;
  private fills: CanvasGradient[];
  private sheen: CanvasGradient;
  private shadow: HTMLCanvasElement | null;
  private s = [0, 0, 0, 0]; // per card this frame: scale, and centre on the sheet
  private x = [0, 0, 0, 0];
  private y = [0, 0, 0, 0];

  // hover: a move from (from, vel) at t0 towards `to`, over `dur` seconds
  private want = 0;
  private pending = false;
  private from = 0;
  private vel = 0;
  private to = 0;
  private t0 = 0;
  private dur = 0;

  private constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.canvas = canvas;
    this.ctx = ctx;
    // the coloured glass is mixed on its own layer, then laid on the paper in one go
    const k = canvas.width / SHEET_W;
    const layer = document.createElement("canvas");
    layer.width = Math.ceil(GLASS.w * k) + 2;
    layer.height = Math.ceil(GLASS.h * k) + 2;
    this.glass = layer.getContext("2d");
    const gctx = this.glass ?? ctx;
    this.fills = LOOKS.map((look) => {
      const g = gctx.createLinearGradient(look.from[0], look.from[1], look.to[0], look.to[1]);
      for (const [at, color] of look.stops) g.addColorStop(at, color);
      return g;
    });
    // light from the upper left: a soft sheen there, a breath of shade at the far side
    const sheen = ctx.createLinearGradient(-HALF / 2, -HALF / 2, HALF / 2, HALF / 2);
    sheen.addColorStop(0, "rgba(255, 255, 255, 0.14)");
    sheen.addColorStop(0.3, "rgba(255, 255, 255, 0)");
    sheen.addColorStop(1, "rgba(40, 20, 90, 0.04)");
    this.sheen = sheen;
    this.shadow = this.makeShadow();
  }

  static create(width = 800, height = 1000): HuskSource | null {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    // on a phone the sheet is ~300 css px wide: a smaller picture, same drawing (it scales with the canvas)
    const k = handheld() ? HANDHELD_SCALE : 1;
    canvas.width = Math.max(1, Math.round(width * k));
    canvas.height = Math.max(1, Math.round(height * k));
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;
    return new HuskSource(canvas, ctx);
  }

  // One soft diamond, blurred once here; each frame only places it.
  private makeShadow(): HTMLCanvasElement | null {
    const k = this.canvas.width / SHEET_W;
    const pad = SHADOW_BLUR * 3;
    const w = Math.ceil((LEFT + RIGHT + 2 * pad) * k), h = Math.ceil((TOP + BOTTOM + 2 * pad) * k);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    if (!g) return null;
    // draw the shape off the canvas and let only its blurred shadow land on it
    g.shadowColor = SHADOW_INK;
    g.shadowBlur = SHADOW_BLUR * k * 2;
    g.shadowOffsetX = w * 2;
    g.setTransform(k * A11, k * A21, k * A12, k * A22, (LEFT + pad) * k - w * 2, (TOP + pad) * k);
    g.fillStyle = "#000";
    g.fill(this.face);
    return c;
  }

  hover(on: boolean): void {
    const want = on ? 1 : 0;
    if (want === this.want) return;
    this.want = want;
    this.pending = true;
  }

  private state(t: number): [number, number] {
    if (this.pending) {
      this.pending = false;
      const [p, v] = this.state(t);
      this.from = p;
      this.vel = v;
      this.to = this.want;
      this.t0 = t;
      this.dur = MOVE * (0.5 + 0.5 * Math.min(1, Math.abs(this.to - p)));
    }
    const u = this.dur > 0 ? (t - this.t0) / this.dur : 1;
    if (u >= 1) return [this.to, 0];
    if (u <= 0) return [this.from, this.vel];
    return easeState(this.from, this.vel, this.to, this.dur, u);
  }

  changed(timeSec: number): boolean {
    const p = this.state(timeSec)[0];
    if (this.first) {
      this.first = false;
      return true;
    }
    if (timeSec - this.last < MIN_FRAME) return false;
    return Math.abs(p - this.drawn) > 1e-4;
  }

  render(timeSec: number): void {
    if (this.disposed) return;
    const p = this.state(timeSec)[0];
    this.drawn = p;
    this.last = timeSec;
    const spread = 1 + (SPREAD - 1) * p;

    const { ctx, canvas } = this;
    const k = canvas.width / SHEET_W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const { s, x, y } = this;
    for (let i = 0; i < 4; i++) {
      const z = depth(i, spread);
      s[i] = F / z;
      x[i] = EYE_X + s[i] * (MID_X + (i - 1.5) * spread * STEP_X);
      y[i] = EYE_Y + s[i] * TOP;
    }

    const place = (i: number) => {
      const m = k * s[i];
      ctx.setTransform(m * A11, m * A21, m * A12, m * A22, k * x[i], k * y[i]);
    };

    // Shadows only where the paper shows between and around the cards: seen through the
    // glass they would only dull its colours.
    const shadow = this.shadow;
    if (shadow) {
      ctx.save();
      for (let i = 0; i < 4; i++) {
        place(i);
        ctx.clip(this.outside, "evenodd");
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let i = 0; i < 4; i++) {
        const d = PAPER_Z - depth(i, spread);
        const grow = s[i] * (0.96 + d / 2600);
        const w = shadow.width * grow, h = shadow.height * grow;
        const cx = (x[i] + d * SHADOW_DX) * k, cy = (y[i] + d * SHADOW_DY) * k;
        const ox = (LEFT + SHADOW_BLUR * 3) * k * grow, oy = (TOP + SHADOW_BLUR * 3) * k * grow;
        ctx.globalAlpha = LOOKS[i].shadow * (1.25 - d / 1200);
        ctx.drawImage(shadow, cx - ox, cy - oy, w, h);
      }
      ctx.restore();
    }

    // The glass first, mixed in the logo's order so the overlaps take the logo's colours;
    // then the light on each sheet and its edge, from the back of the row to the front,
    // which is what tells which sheet stands before which.
    const glass = this.glass;
    if (!glass) {
      for (let i = 0; i < 4; i++) {
        place(i);
        ctx.fillStyle = this.fills[i];
        ctx.fill(this.face);
      }
    } else {
      const ox = Math.floor(GLASS.x * k), oy = Math.floor(GLASS.y * k);
      glass.setTransform(1, 0, 0, 1, 0, 0);
      glass.clearRect(0, 0, glass.canvas.width, glass.canvas.height);
      for (let i = 0; i < 4; i++) {
        const m = k * s[i];
        glass.setTransform(m * A11, m * A21, m * A12, m * A22, k * x[i] - ox, k * y[i] - oy);
        glass.fillStyle = this.fills[i];
        glass.globalCompositeOperation = "source-over";
        glass.globalAlpha = 1 - MIX;
        glass.fill(this.face);
        glass.globalCompositeOperation = "lighter";
        glass.globalAlpha = MIX;
        glass.fill(this.face);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(glass.canvas, ox, oy);
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 1.2;
    for (let i = 3; i >= 0; i--) {
      place(i);
      ctx.fillStyle = this.sheen;
      ctx.fill(this.face);
      ctx.fillStyle = LOOKS[i].edge;
      ctx.fill(this.edge);
      ctx.stroke(this.rim);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.shadow) this.shadow.width = this.shadow.height = 1;
    if (this.glass) this.glass.canvas.width = this.glass.canvas.height = 1;
    this.shadow = null;
    this.glass = null;
    this.canvas.width = this.canvas.height = 1;
  }
}
