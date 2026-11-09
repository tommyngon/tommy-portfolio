// Offscreen "live picture" of the Staerk menu dial, for another renderer to upload as a
// texture each frame. Same geometry and styling as the app (menuRingMath, tickDialMath):
// 60 ticks at a 6 degree pitch roll past an emphasis group that rests at 12 o'clock, exactly
// as the ring's ticks roll under its pointer. The wordmark is the sheet's `mark` layer.

const INK = "#ececee"; // --menu-ring-tick in the app's dark theme
const BG = "#000";

// Sheet units (the still is 1200 x 1500); the dial is centred on the wordmark.
const SHEET_W = 1200;
const CX = 600;
const CY = 706.5;
const SCALE = 3.2; // app px to sheet units
const R_OUTER = 103 * SCALE; // the app's tick radius on a phone-width ring (size 342)

const STEP = 6; // degrees between ticks
const TICKS = 360 / STEP;
const SPAN = 4; // ticks either side of the pointer that are emphasised
const BASE_LEN = 8;
const MAX_LEN = 24;
const BASE_WIDTH = 1;
const MAX_WIDTH = 2.5;
const BASE_OPACITY = 0.35;

const DEG_PER_SEC = 12; // one turn in 30 s; the picture repeats every 6 degrees, so it never jumps
const MIN_FRAME = 1 / 90; // on high refresh screens, re-upload about every other frame

export class DialSource {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private disposed = false;
  private last = -1;

  private constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.canvas = canvas;
    this.ctx = ctx;
  }

  static create(width = 800, height = 1000): DialSource | null {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;
    return new DialSource(canvas, ctx);
  }

  changed(timeSec: number): boolean {
    if (timeSec - this.last < MIN_FRAME) return false;
    this.last = timeSec;
    return true;
  }

  private tick(angle: number, len: number) {
    const a = (angle * Math.PI) / 180;
    const sx = Math.sin(a), cy = -Math.cos(a);
    this.ctx.moveTo(CX + (R_OUTER - len) * sx, CY + (R_OUTER - len) * cy);
    this.ctx.lineTo(CX + R_OUTER * sx, CY + R_OUTER * cy);
  }

  render(timeSec: number): void {
    if (this.disposed) return;
    const { ctx, canvas } = this;
    const scale = canvas.width / SHEET_W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.strokeStyle = INK;
    ctx.lineCap = "round";

    const phase = (timeSec * DEG_PER_SEC) % STEP;
    // the ticks at rest share one stroke; each emphasised tick gets its own weight
    ctx.globalAlpha = BASE_OPACITY;
    ctx.lineWidth = BASE_WIDTH * SCALE;
    ctx.beginPath();
    const near: { angle: number; e: number }[] = [];
    for (let i = 0; i < TICKS; i++) {
      const angle = i * STEP + phase;
      const dist = Math.abs(((angle + 180) % 360) - 180) / STEP; // ticks from 12 o'clock
      const e = (SPAN + 1 - dist) / (SPAN + 1);
      if (e > 0) near.push({ angle, e });
      else this.tick(angle, BASE_LEN * SCALE);
    }
    ctx.stroke();
    for (const { angle, e } of near) {
      ctx.globalAlpha = BASE_OPACITY + (1 - BASE_OPACITY) * e;
      ctx.lineWidth = (BASE_WIDTH + (MAX_WIDTH - BASE_WIDTH) * e) * SCALE;
      ctx.beginPath();
      this.tick(angle, (BASE_LEN + (MAX_LEN - BASE_LEN) * e) * SCALE);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.width = this.canvas.height = 1;
  }
}
