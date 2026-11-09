// Offscreen "live picture" of the Stackwise landing keycaps, for another renderer to upload
// as a texture each frame. Same projection, colours and press loop as the site's hero
// (stackwise-tetris.vercel.app); no wordmark or page around it, the keyboard fills the sheet.

// colours sampled by the site from its reference poster
const PK = "#f955b4";
const DK = "#f7219d";
const YL = "#f8ff8b";
const LM = "#d7e900";
const DECK = "#eff57f"; // the tray, a touch below YL so the rear keys still stand off it

// Isometric grid (u, v) on the tray plane, z = height. 1 cell = 120 x 62.5 site units.
const R = 62.5 / 120;
type Pt = readonly [number, number];
const P = (u: number, v: number, z = 0): Pt => [120 * (u - v), 62.5 * (u + v) - z];

const TOP = 0.4; // half-width of a cap's top face, in cells
const BASE = 0.44; // half-width of its skirt
const TRAY = 0.2; // tray lip around the cluster
const BACK = 7; // the tray runs on behind the cluster, so its deck reaches the top corners
const PRESS = 30; // how far a press sinks a cap

// The sheet's window on the site's coordinates, 4:5, centred on the cluster.
const VIEW = { x: -372, y: -226, w: 744, h: 930 };

// [u, v, label, height, press delay in s (null for the sunk lime wells)]
type Key = readonly [number, number, string, number, number | null];
const KEYS: Key[] = [
  [0, 0, "F", 80, 0],
  [1, 0, "E", 80, 3.1],
  [0, 1, "C", 15, null],
  [2, 0, "A", 80, 1.5],
  [1, 1, "Z", 80, 0.75],
  [0, 2, "X", 80, 2.35],
  [2, 1, "V", 15, null],
  [1, 2, "Ctrl", 15, null],
  [2, 2, "Alt", 80, 3.9],
];

const CYCLE = 4; // seconds between two presses of the same key

const PRESS_END = 0.066; // a press animates for this fraction of the cycle, the rest is still

const easeIn = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// One press, as the site's keyframes: down, a beat held, back with a hair of overshoot.
// Returns the sink in site units (`down`) and how far the cap is darkened (`shade`, 0..1).
function pressAt(time: number, delay: number): { down: number; shade: number } {
  const p = (((time - delay) % CYCLE) + CYCLE) % CYCLE / CYCLE;
  if (p < 0.016) {
    const k = easeIn(p / 0.016);
    return { down: PRESS * k, shade: k };
  }
  if (p < 0.03) return { down: PRESS, shade: 1 };
  if (p < 0.052) {
    const k = easeOut((p - 0.03) / 0.022);
    return { down: PRESS + (-1.5 - PRESS) * k, shade: 1 - k };
  }
  if (p < PRESS_END) return { down: -1.5 + 1.5 * ((p - 0.052) / 0.014), shade: 0 };
  return { down: 0, shade: 0 };
}

function polygon(pts: readonly Pt[]): Path2D {
  const path = new Path2D();
  pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  return path;
}

// The skirt flares a little toward the base: one control point per side edge.
const flare = (t: Pt, b: Pt): Pt => [t[0] + (b[0] - t[0]) * 0.2, t[1] + (b[1] - t[1]) * 0.7];

// One keycap in local coords (origin = centre of its base on the tray).
function capPaths(H: number) {
  const L = P(-TOP, TOP, H), T = P(-TOP, -TOP, H), Rr = P(TOP, -TOP, H), B = P(TOP, TOP, H);
  const Lb = P(-BASE, BASE), Rb = P(BASE, -BASE), Bb = P(BASE, BASE);
  const body = new Path2D();
  body.moveTo(...L);
  body.lineTo(...T);
  body.lineTo(...Rr);
  body.quadraticCurveTo(...flare(Rr, Rb), ...Rb);
  body.lineTo(...Bb);
  body.lineTo(...Lb);
  body.quadraticCurveTo(...flare(L, Lb), ...L);
  body.closePath();
  const left = new Path2D();
  left.moveTo(...L);
  left.lineTo(...B);
  left.lineTo(...Bb);
  left.lineTo(...Lb);
  left.quadraticCurveTo(...flare(L, Lb), ...L);
  left.closePath();
  return { body, left, top: polygon([L, T, Rr, B]) };
}

const CAPS = new Map<number, ReturnType<typeof capPaths>>();
function capOf(H: number) {
  let cap = CAPS.get(H);
  if (!cap) CAPS.set(H, (cap = capPaths(H)));
  return cap;
}

function tint(hex: string, shade: number): string {
  if (shade <= 0) return hex;
  const n = parseInt(hex.slice(1), 16);
  const b = 1 - 0.07 * shade; // the site's brightness(.93) at the bottom of a press
  return `rgb(${Math.round(((n >> 16) & 255) * b)},${Math.round(((n >> 8) & 255) * b)},${Math.round((n & 255) * b)})`;
}

// Clips a moving cap to the space above its own footprint, so a press sinks it into the tray.
function sinkClip(): Path2D {
  const Lb = P(-BASE, BASE), Rb = P(BASE, -BASE), Bb = P(BASE, BASE);
  return polygon([[-300, -300], [300, -300], [300, Rb[1] + 0.5], [Rb[0], Rb[1] + 0.5], [0, Bb[1] + 0.5], [Lb[0], Lb[1] + 0.5], [-300, Lb[1] + 0.5]]);
}

export class KeysSource {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private clip = sinkClip();
  private disposed = false;
  private pressedLastFrame = false;

  private constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.canvas = canvas;
    this.ctx = ctx;
  }

  static create(width = 800, height = 1000): KeysSource | null {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;
    return new KeysSource(canvas, ctx);
  }

  private drawCap(H: number, lime: boolean, label: string, shade: number) {
    const { ctx } = this;
    const cap = capOf(H);
    ctx.fillStyle = tint(DK, shade);
    ctx.fill(cap.body);
    ctx.fillStyle = tint(PK, shade);
    ctx.fill(cap.left);
    ctx.fillStyle = tint(lime ? LM : YL, shade);
    ctx.fill(cap.top);
    const big = label.length > 1;
    ctx.save();
    ctx.transform(1, -R, 1, R, 0, -H);
    ctx.fillStyle = tint(lime ? PK : LM, shade);
    ctx.font = `500 ${big ? 36 : 43}px Inter, "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(label, 0, big ? 12 : 15);
    ctx.restore();
  }

  private drawTray() {
    const { ctx } = this;
    const g = 3 + TRAY;
    const deep = VIEW.y + VIEW.h + 10; // the faces run off the bottom of the sheet
    const tl = P(-BACK, g), tf = P(g, g), tr = P(g, -BACK), tb = P(-BACK, -BACK);
    ctx.fillStyle = PK;
    ctx.fill(polygon([tl, tf, [tf[0], deep], [tl[0], deep]]));
    ctx.fillStyle = DK;
    ctx.fill(polygon([tf, tr, [tr[0], deep], [tf[0], deep]]));
    ctx.fillStyle = DECK;
    ctx.fill(polygon([tl, tb, tr, tf]));
  }

  /** False while every key is at rest (about 60% of the time): no redraw or re-upload needed. */
  changed(timeSec: number): boolean {
    const pressing = KEYS.some(([, , , , delay]) => {
      if (delay === null) return false;
      const p = (((timeSec - delay) % CYCLE) + CYCLE) % CYCLE / CYCLE;
      return p < PRESS_END;
    });
    const out = pressing || this.pressedLastFrame; // one more frame after a press ends, so the key is drawn back at rest
    this.pressedLastFrame = pressing;
    return out;
  }

  /** Draws one frame at `timeSec`; `pressing: false` draws every key at rest (the still). */
  render(timeSec: number, pressing = true): void {
    if (this.disposed) return;
    const { ctx, canvas } = this;
    const scale = canvas.width / VIEW.w;
    ctx.setTransform(scale, 0, 0, scale, -VIEW.x * scale, -VIEW.y * scale);
    this.drawTray();
    for (const [u, v, label, H, delay] of KEYS) {
      const [x, y] = P(u + 0.5, v + 0.5);
      ctx.save();
      ctx.translate(x, y);
      if (delay === null) {
        this.drawCap(H, true, label, 0);
      } else {
        ctx.clip(this.clip);
        const { down, shade } = pressing ? pressAt(timeSec, delay) : { down: 0, shade: 0 };
        ctx.translate(0, down);
        this.drawCap(H, false, label, shade);
      }
      ctx.restore();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.width = this.canvas.height = 1;
  }
}
