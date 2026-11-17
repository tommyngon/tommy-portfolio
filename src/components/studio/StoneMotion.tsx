"use client";
import { useEffect, useRef } from "react";
import type { StoneFrame, StoneRenderer } from "./gl/stone";
import s from "./StoneEnd.module.css";

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
// ease in-out (cubic): no velocity jumps at either end of a stretch
const ease = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// The choreography, in viewport heights of scroll from the moment the pinned name would start
// to scroll away (u = 0). The last screen is pinned from u = P on; the page ends at u = end.
const STONE_BEFORE = 0.42; // the stone starts to come into focus this far before P
const STONE_PAST = 0.1; // ...and is sharp and whole this far past P
const NAME_PAST = 0.02; // the name starts to grow this far past P
const NAME_SPAN = 0.46; // ...and has settled at the bottom this much later
const FOOT_PAST = 0.3; // the footer starts to arrive this far past P

const DRIFT = [0.035, 0.13, 0] as const; // rad/s about the screen's x, y, z: the stone's own slow turn
const RETURN = 1.6; // s, a thrown stone settles back to the drift
const LIGHT_LAG = 0.3; // s, the light trails the pointer
// the pose of the still (public/home/stone.webp), column-major
const POSE = [0.905, 0.2065, -0.372, -0.0954, 0.9506, 0.2955, 0.4146, -0.232, 0.8799];

// R <- rot(axis x, y, z by small angles) * R, kept orthonormal
function spin(R: Float32Array, ax: number, ay: number, az: number) {
  const a = Math.hypot(ax, ay, az);
  if (a < 1e-7) return;
  const x = ax / a, y = ay / a, z = az / a;
  const c = Math.cos(a), si = Math.sin(a), t = 1 - c;
  // rows of the rotation
  const m = [t * x * x + c, t * x * y - si * z, t * x * z + si * y, t * x * y + si * z, t * y * y + c, t * y * z - si * x, t * x * z - si * y, t * y * z + si * x, t * z * z + c];
  for (let col = 0; col < 3; col++) {
    const v0 = R[col * 3], v1 = R[col * 3 + 1], v2 = R[col * 3 + 2];
    R[col * 3] = m[0] * v0 + m[1] * v1 + m[2] * v2;
    R[col * 3 + 1] = m[3] * v0 + m[4] * v1 + m[5] * v2;
    R[col * 3 + 2] = m[6] * v0 + m[7] * v1 + m[8] * v2;
  }
  // Gram-Schmidt on the columns, so rounding never skews the stone
  const n = (i: number) => {
    const l = Math.hypot(R[i], R[i + 1], R[i + 2]) || 1;
    R[i] /= l; R[i + 1] /= l; R[i + 2] /= l;
  };
  n(0);
  const d = R[0] * R[3] + R[1] * R[4] + R[2] * R[5];
  R[3] -= d * R[0]; R[4] -= d * R[1]; R[5] -= d * R[2];
  n(3);
  R[6] = R[1] * R[5] - R[2] * R[4];
  R[7] = R[2] * R[3] - R[0] * R[5];
  R[8] = R[0] * R[4] - R[1] * R[3];
}

// Writes a style only when it changes.
function writer() {
  const last = new Map<HTMLElement, Map<string, string>>();
  return (el: HTMLElement | null | undefined, prop: string, value: string) => {
    if (!el) return;
    let m = last.get(el);
    if (!m) last.set(el, (m = new Map()));
    if (m.get(prop) === value) return;
    m.set(prop, value);
    el.style.setProperty(prop, value);
  };
}

// The scroll-linked ending (see StoneEnd), and the stone itself. The pinned name never leaves:
// it is held where it stood while the last screen arrives, then grows and glides down into
// the place kept for it at the bottom, as the footer rises in above it. The stone, whole from
// the first frame, comes into focus on its own as its screen arrives. All of it follows the
// scroll, so it plays back the same way. The stone turns
// slowly on its own, can be thrown round by dragging, and is lit by a light that trails the
// pointer. The WebGL part is imported once the ending is within a few screens; until it is
// ready (or without WebGL2) the still stands in. Reduced motion: none of this, a plain screen.
export default function StoneMotion() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = canvas?.closest<HTMLElement>("[data-stone-end]");
    if (!canvas || !root) return;
    const q = (k: string) => root.querySelector<HTMLElement>(`[data-k="${k}"]`);
    const track = q("track");
    const stage = q("stage");
    const text = q("text");
    const stone = q("stone");
    const still = q("still");
    const caption = q("caption");
    const finale = q("finale");
    const finalName = q("final");
    const rule = q("rule");
    const reveals = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const finalLetters = finalName?.querySelector<HTMLElement>("[data-letters]") ?? null;
    const pin = document.querySelector<HTMLElement>("[data-name-pin]");
    const pinLetters = pin?.querySelector<HTMLElement>("[data-letters]") ?? null;
    const pinName = pinLetters?.parentElement ?? null;
    if (!track || !stage || !text || !stone || !finale || !finalName || !finalLetters) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.dataset.motion = "";

    const set = writer();
    const flag = (el: HTMLElement | null | undefined, name: string, on: boolean) => {
      if (!el || name in el.dataset === on) return;
      if (on) el.dataset[name] = "";
      else delete el.dataset[name];
    };
    let gl: StoneRenderer | null = null;
    let disposed = false;
    let raf = 0;
    let running = false;
    let lastT = 0;

    // geometry, refreshed on resize
    let V = 1; // stage height
    let inset = 0; // the pinned name's distance from the bottom
    let trackH = 1;
    let side = 1; // the stone's square, css px
    let pinH = 1; // the pinned name's height (one em)
    let grown = 1; // how many times larger the name is at the bottom
    let vw = 1;
    const measure = () => {
      V = stage.clientHeight || window.innerHeight;
      inset = pin ? parseFloat(getComputedStyle(pin).bottom) || 0 : 0;
      trackH = track.offsetHeight;
      side = stone.offsetWidth || 1;
      vw = window.innerWidth;
      if (pinName) {
        // from the type sizes (one em each), which unlike the boxes are not rounded to whole px
        pinH = parseFloat(getComputedStyle(pinName).fontSize) || 1;
        grown = (parseFloat(getComputedStyle(finalName).fontSize) || pinH) / pinH;
      }
    };

    // ---- the stone: orientation, throw, light ----
    const R = new Float32Array(POSE);
    const w = [DRIFT[0], DRIFT[1], DRIFT[2]]; // angular velocity, rad/s
    let held = false;
    let holdId = -1;
    let px = 0;
    let py = 0;
    let pt = 0;
    let mx = NaN; // pointer, client px (mouse or pen only)
    let my = NaN;
    let lx = NaN; // the light, px in the square
    let ly = NaN;
    let light = 0;
    let quality = 1;
    let slow = 0;
    let lastRender = 0;
    let minGap = 1000 / 60;
    let shown = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const onStone = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) < r.width * 0.36;
    };
    const onDown = (e: PointerEvent) => {
      if (held || (e.pointerType === "mouse" && e.button !== 0) || !onStone(e)) return;
      held = true;
      holdId = e.pointerId;
      px = e.clientX;
      py = e.clientY;
      pt = performance.now();
      w[0] = w[1] = w[2] = 0;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
      flag(canvas, "held", true);
    };
    const onDrag = (e: PointerEvent) => {
      if (e.pointerType !== "touch") flag(canvas, "over", held || onStone(e));
      if (!held || e.pointerId !== holdId) return;
      const now = performance.now();
      const k = 1.15 / (side / 3); // a drag of one stone unit turns it about a radian
      // a finger only turns it sideways: upright movement belongs to the scroll
      const ax = e.pointerType === "touch" ? 0 : (e.clientY - py) * k;
      const ay = (e.clientX - px) * k;
      spin(R, ax, ay, 0);
      const dt = Math.max(0.004, (now - pt) / 1000);
      const m = Math.min(1, dt / 0.06); // a short running average, so the throw is the hand's last motion
      w[0] += (ax / dt - w[0]) * m;
      w[1] += (ay / dt - w[1]) * m;
      w[2] = 0;
      px = e.clientX;
      py = e.clientY;
      pt = now;
    };
    const onUp = (e: PointerEvent) => {
      if (!held || e.pointerId !== holdId) return;
      held = false;
      flag(canvas, "held", false);
      // a hand that stopped before letting go throws nothing
      if (performance.now() - pt > 90) w[0] = w[1] = 0;
      const sp = Math.hypot(w[0], w[1]);
      if (sp > 7) {
        w[0] *= 7 / sp;
        w[1] *= 7 / sp;
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      mx = e.clientX;
      my = e.clientY;
    };
    const onLeave = () => {
      mx = NaN;
      my = NaN;
    };

    const rest = () => {
      set(pin, "transform", "");
      set(pin, "--u", "");
    };
    const hideGL = () => {
      if (!shown) return;
      shown = false;
      set(canvas, "visibility", "hidden");
      flag(canvas, "live", false);
      gl?.clear();
    };

    const frame = (now: number) => {
      const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 1 / 60;
      if (lastT) minGap = Math.min(minGap * 1.002, now - lastT);
      lastT = now;

      // ---- reads first, then writes ----
      const tr = track.getBoundingClientRect();
      const sr = stone.getBoundingClientRect();
      const u = (V - inset - tr.top) / V;
      const P = (V - inset) / V;
      const end = (trackH - inset) / V;
      const fr = finalLetters.getBoundingClientRect();

      // ---- the statement ----
      if (!("on" in text.dataset) && tr.top < V * 0.72) text.dataset.on = "";

      // ---- the name: held where it stood, then grown into its place at the bottom ----
      if (pin) {
        if (u <= 0) rest();
        else {
          // past u = 0 the page would carry it off: the shift keeps it standing. The growth is on
          // the same box (about its centre), so the letters never leave it and stay hoverable.
          const e = ease((u - P - NAME_PAST) / NAME_SPAN);
          const k = 1 + (grown - 1) * e;
          const dy = u * V + (fr.top + fr.height / 2 - (V - inset - pinH / 2)) * e;
          set(pin, "transform", e > 0 ? `translateY(${dy.toFixed(1)}px) scale(${k.toFixed(4)})` : `translateY(${dy.toFixed(1)}px)`);
          // the halo is set in page units: shrink the unit as the name grows, so it stays as fine
          set(pin, "--u", e > 0 ? `${(vw / 1470 / k).toFixed(4)}px` : "");
        }
      }

      // ---- the footer: a hairline, then place and contact ----
      const f0 = P + FOOT_PAST;
      const cu = clamp01((u - f0) / Math.max(0.05, end - 0.04 - f0));
      set(rule, "transform", `scaleX(${ease(cu / 0.7).toFixed(4)})`);
      reveals.forEach((el, i) => {
        const k = ease((cu - 0.06 - i * 0.12) / 0.56);
        set(el, "opacity", k.toFixed(3));
        set(el, "transform", k < 1 ? `translate3d(0, ${((1 - k) * 14).toFixed(1)}px, 0)` : "");
      });
      flag(finale, "live", cu > 0.5);

      // ---- the stone ----
      // rock-shaped from the first frame: it only comes into focus, a touch small, and settles
      const arrive = smooth(P - STONE_BEFORE, P + STONE_PAST, u);
      const alpha = smooth(0, 0.7, arrive);
      const soft = (1 - ease(arrive)) * side * 0.035;
      set(stone, "scale", arrive < 1 ? (0.9 + 0.1 * ease(arrive)).toFixed(4) : "");
      set(stone, "filter", soft > 0.3 ? `blur(${soft.toFixed(1)}px)` : "");
      set(caption, "opacity", smooth(P + 0.02, P + 0.3, u).toFixed(3));
      set(still, "opacity", gl ? "0" : alpha.toFixed(3));
      if (!gl || alpha <= 0 || sr.bottom < -40 || sr.top > V + 40) {
        hideGL();
        return;
      }

      // its own slow turn; a throw decays back to it
      if (!held) {
        const k = 1 - Math.exp(-dt / RETURN);
        for (let i = 0; i < 3; i++) w[i] += (DRIFT[i] - w[i]) * k;
        spin(R, w[0] * dt, w[1] * dt, w[2] * dt);
      }
      // the light trails the pointer and fades in as it comes near
      const cxp = sr.left + sr.width / 2;
      const cyp = sr.top + sr.height / 2;
      const near = !Number.isNaN(mx) && Math.hypot(mx - cxp, my - cyp) < side * 0.75;
      if (near) {
        const tx = mx - sr.left;
        const ty = my - sr.top;
        if (Number.isNaN(lx) || light < 0.01) {
          lx = tx;
          ly = ty;
        }
        const k = 1 - Math.exp(-dt / LIGHT_LAG);
        lx += (tx - lx) * k;
        ly += (ty - ly) * k;
      }
      light += ((near ? 1 : 0) - light) * (1 - Math.exp(-dt / (near ? 0.35 : 0.6)));
      if (light < 0.002) light = 0;

      if (!shown) {
        shown = true;
        set(canvas, "visibility", "visible");
      }
      flag(canvas, "live", arrive > 0.95);

      // step the resolution down if frames run long (judged against the display's own rate)
      if (lastRender) {
        slow = now - lastRender > Math.max(20, 1.6 * minGap) ? slow + 1 : Math.max(0, slow - 1);
        if (slow > 14 && quality > 0.6) {
          quality = Math.max(0.6, quality * 0.8);
          slow = 0;
        }
      }
      lastRender = now;
      const f: StoneFrame = {
        size: side,
        unit: side / 3,
        rot: R,
        lightX: Number.isNaN(lx) ? side / 2 : lx,
        lightY: Number.isNaN(ly) ? side / 2 : ly,
        light,
        form: 1,
        alpha,
      };
      gl.setScale(dpr * quality);
      gl.render(f);
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      frame(now);
    };
    const start = () => {
      if (running) return;
      running = true;
      lastT = 0;
      lastRender = 0;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      // far above the ending: everything at rest
      rest();
      hideGL();
    };

    const nearby = new IntersectionObserver((es) => (es.some((e) => e.isIntersecting) ? start() : stop()), {
      rootMargin: "60% 0px 60% 0px",
    });
    nearby.observe(track);

    // ---- WebGL, on approach ----
    let settle = 0;
    let idle = 0;
    // compiling waits for a pause in the scrolling: Safari has no background compile, and a
    // stall mid-scroll would show
    let lastScroll = 0;
    const onScroll = () => {
      lastScroll = performance.now();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const quiet = () =>
      new Promise<void>((res) => {
        const t0 = performance.now();
        const check = () => {
          const now = performance.now();
          if (disposed || now - lastScroll > 220 || now - t0 > 4000) res();
          else window.setTimeout(check, 90);
        };
        check();
      });
    const load = async () => {
      if (disposed || gl) return;
      try {
        await quiet();
        if (disposed) return;
        const mod = await import("./gl/stone");
        if (disposed) return;
        const r = await mod.StoneRenderer.create(canvas);
        if (disposed) {
          r?.dispose();
          return;
        }
        gl = r;
      } catch {
        gl = null;
      }
    };
    // a lost context (iOS can drop one in the background) falls back to the still, and draws
    // again once the context is back
    const onLost = (e: Event) => {
      e.preventDefault();
      gl?.dispose();
      gl = null;
      shown = true;
      hideGL();
    };
    const onRestored = () => void load();
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    const approach = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        approach.disconnect();
        if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(() => void load(), { timeout: 600 });
        else idle = window.setTimeout(() => void load(), 120);
      },
      { rootMargin: "300% 0px 300% 0px" },
    );
    const watch = () => approach.observe(track);
    const afterIntro = () => {
      settle = window.setTimeout(watch, 700);
    };
    if (document.documentElement.dataset.intro === "running") window.addEventListener("studio:intro-done", afterIntro, { once: true });
    else watch();

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    ro.observe(track);
    ro.observe(stone);
    if (pinLetters) ro.observe(pinLetters);
    ro.observe(finalName);
    window.addEventListener("resize", measure);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onDrag);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      nearby.disconnect();
      approach.disconnect();
      ro.disconnect();
      window.clearTimeout(settle);
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      window.removeEventListener("studio:intro-done", afterIntro);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onDrag);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      rest();
      delete root.dataset.motion;
      gl?.dispose();
      gl = null;
    };
  }, []);

  return <canvas ref={canvasRef} className={s.canvas} aria-hidden="true" />;
}

// Back to the top of the page, with the same smoothness as the rest of the scroll.
export function BackToTop() {
  return (
    <button
      type="button"
      className={s.topBtn}
      onClick={() => {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      }}
    >
      Back to top
    </button>
  );
}
