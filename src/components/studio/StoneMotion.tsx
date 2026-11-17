"use client";
import { useEffect, useRef } from "react";
import type { NameLayout, StoneFrame, StoneRenderer } from "./gl/stone";
import s from "./StoneEnd.module.css";

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
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
// to scroll away (u = 0) to the very end of the page (u = end, given by the track's height).
const HANDOFF = 0.02; // the live name cross-fades into the drawn one
const SETTLE = 0.45; // the stage stays pinned this long before the stone is whole
const HOLD = 0.75; // the stone's own slide
const LIGHT_LAG = 0.45; // s, the light trails the pointer

type Box = { x: number; y: number; w: number; h: number };
const rectBox = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

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

// The scroll-linked ending (see StoneEnd). Runs only while the ending is near; the WebGL part
// is imported after the intro, once the ending is within a few screens, and compiles in the
// background. Until it is ready (or without WebGL2) the page shows the still and the live names.
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
    const slide = q("slide");
    const caption = q("caption");
    const still = q("still");
    const finale = q("finale");
    const finalName = q("final");
    const finalLetters = finalName?.querySelector<HTMLElement>("[data-letters]");
    const reveals = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const rule = q("rule");
    const pin = document.querySelector<HTMLElement>("[data-name-pin]");
    const pinLetters = pin?.querySelector<HTMLElement>("[data-letters]");
    if (!track || !stage || !text || !slide || !finale || !finalName || !finalLetters) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      text.dataset.on = "";
      return;
    }
    root.dataset.motion = "";

    const set = writer();
    const touch = window.matchMedia("(hover: none)").matches;
    let gl: StoneRenderer | null = null;
    let disposed = false;
    let raf = 0;
    let running = false;

    // geometry, refreshed on resize
    let V = 1; // stage height
    let inset = 0; // the pinned name's distance from the bottom
    let trackH = 1;
    let vw = 1;
    let vh = 1;
    const measure = () => {
      V = stage.clientHeight || window.innerHeight;
      inset = pin ? parseFloat(getComputedStyle(pin).bottom) || 0 : 0;
      trackH = track.offsetHeight;
      vw = canvas.clientWidth || window.innerWidth;
      vh = canvas.clientHeight || window.innerHeight;
      dirty = true;
    };

    // pointer and light
    let mx = -1;
    let my = -1;
    let lx = NaN;
    let ly = NaN;
    let shards = 0;
    let lastT = 0;
    let dirty = true;
    let lastKey = "";
    let revealed = false;
    let shown = false;
    // resolution: the flat name at the hand-overs is drawn as sharp as the live text; the
    // moving shape steps down if frames run long (judged against the display's own rate)
    const dpr = window.devicePixelRatio || 1;
    const base = Math.min(dpr, 1.5);
    const phone = window.matchMedia("(max-width: 640px)");
    let quality = 1;
    let slow = 0;
    let lastRender = 0;
    let renderedPrev = false;
    let minGap = 1000 / 60;

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      mx = e.clientX;
      my = e.clientY;
    };
    const onLeave = () => {
      mx = -1;
      my = -1;
    };
    // data-* flags, written only when they change
    const flag = (el: HTMLElement | null | undefined, name: string, on: boolean) => {
      if (!el || name in el.dataset === on) return;
      if (on) el.dataset[name] = "";
      else delete el.dataset[name];
    };

    const hideGL = () => {
      renderedPrev = false;
      if (!shown) return;
      shown = false;
      set(canvas, "visibility", "hidden");
      gl?.clear();
      lastKey = "";
    };
    const restNames = () => {
      set(pin, "opacity", "");
      set(pin, "--glow", "");
      flag(pin, "away", false);
      set(finalName, "opacity", "");
      flag(finalName, "away", false);
    };

    const frame = (now: number) => {
      const dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 1 / 60;
      if (lastT) minGap = Math.min(minGap * 1.002, now - lastT);
      lastT = now;

      // ---- reads first, then writes ----
      const tr = track.getBoundingClientRect();
      const pinR = pin?.getBoundingClientRect();
      const pinL = pinLetters ? rectBox(pinLetters) : null;
      const dst = rectBox(finalLetters);

      const u = (V - inset - tr.top) / V;
      const end = (trackH - inset) / V;
      const aEnd = (V - inset) / V + SETTLE;
      const hEnd = aEnd + HOLD;
      const cu = clamp01((u - hEnd) / (end - hEnd));
      const ready = gl !== null;

      // ---- the page around it ----
      if (!revealed && u > (V - inset) / V - 0.4) {
        revealed = true;
        text.dataset.on = "";
      }
      // the slide leaves upwards with the scroll once the stone has begun to turn back
      const lift = Math.max(0, u - hEnd - 0.04) * V;
      set(slide, "transform", lift > 0 ? `translate3d(0, ${(-lift).toFixed(1)}px, 0)` : "");
      const capIn = smooth(aEnd - 0.12, aEnd, u) * (1 - smooth(hEnd - 0.08, hEnd + 0.02, u));
      set(caption, "opacity", capIn.toFixed(3));
      set(still, "visibility", ready ? "hidden" : "");
      // place, contact and the rest rise into place one after another, over a hairline
      reveals.forEach((el, i) => {
        const k = ease((cu - 0.5 - i * 0.06) / 0.28);
        set(el, "opacity", k.toFixed(3));
        set(el, "transform", k < 1 ? `translate3d(0, ${((1 - k) * 18).toFixed(1)}px, 0)` : "");
      });
      set(rule, "transform", `scaleX(${ease((cu - 0.44) / 0.4).toFixed(4)})`);
      flag(finale, "live", cu > 0.6);

      // ---- the name, the stone ----
      if (!ready) {
        restNames();
        hideGL();
        return;
      }
      // Hand-overs. The drawn name matches the live one pixel for pixel, so the upper copy fades
      // in over the lower, which stays solid until it is covered (two half-faded copies would
      // read paler), while the halos trade places. At the start the drawn name fades in over the
      // pinned one just before that would begin to scroll away; at the end the live name fades
      // in over the drawn one once it has come to rest.
      const toGL = clamp01((u + HANDOFF) / HANDOFF);
      const toDom = smooth(0.92, 0.985, cu);
      const pinAway = u >= 0;
      set(pin, "opacity", pinAway ? "0" : "");
      set(pin, "--glow", pinAway || toGL <= 0 ? "" : (1 - toGL).toFixed(3));
      flag(pin, "away", pinAway);
      set(finalName, "opacity", toDom.toFixed(3));
      flag(finalName, "away", toDom <= 0);
      const alpha = toDom >= 1 ? 0 : toGL;
      if (alpha <= 0) {
        hideGL();
        return;
      }

      // where the pinned name sticks (also once it has scrolled on, e.g. after a reload part-way down)
      const src = pinL && pinR ? { ...pinL, y: pinL.y + (V - inset - pinR.bottom) } : null;
      const small = phone.matches;
      const stonePx = Math.min(0.28 * V, small ? 0.34 * vw : 0.185 * vw);
      const sx = vw / 2;
      const sy = V * 0.56;

      let m: number;
      let cx: number;
      let cy: number;
      let font: number;
      let hold = 0;
      if (u < hEnd) {
        const a = Math.max(0, u) / aEnd;
        m = smooth(0.03, 0.97, a);
        const w = ease((a - 0.02) / 0.8);
        const from = src ?? dst;
        cx = lerp(from.x + from.w / 2, sx, w);
        cy = lerp(from.y + from.h / 2, sy, w);
        font = from.h;
        hold = clamp01((u - aEnd) / HOLD);
      } else {
        m = 1 - smooth(0, 0.82, cu);
        const w = ease((cu - 0.05) / 0.85);
        cx = lerp(sx, dst.x + dst.w / 2, w);
        cy = lerp(sy, dst.y + dst.h / 2, w);
        font = dst.h;
        hold = 1 + cu * 0.4;
      }
      const em = ease(m);
      const mid = Math.sin(Math.PI * m); // a tumble that peaks half-way
      // squeezed this far, the name fits inside the stone it becomes
      const emW = dst.w / dst.h;
      const sqMin = Math.min(0.6, Math.max(0.22, (1.5 * stonePx) / (emW * font)));

      // the light: trails the pointer; on touch it drifts round the stone with the scroll
      let tx: number;
      let ty: number;
      if (!touch && mx >= 0) {
        tx = mx;
        ty = my;
      } else {
        const ang = 3.6 + u * 1.6;
        tx = sx + Math.cos(ang) * stonePx * 1.3;
        ty = sy + Math.sin(ang) * stonePx * 0.9;
      }
      if (Number.isNaN(lx)) {
        lx = tx;
        ly = ty;
      }
      const k = 1 - Math.exp(-dt / LIGHT_LAG);
      lx += (tx - lx) * k;
      ly += (ty - ly) * k;
      if (Math.abs(tx - lx) < 0.5 && Math.abs(ty - ly) < 0.5) {
        lx = tx;
        ly = ty;
      }
      const near = !touch && mx >= 0 && Math.hypot(mx - sx, my - sy) < stonePx * 1.6 ? 1 : 0;
      shards += (near - shards) * (1 - Math.exp(-dt / 0.25));
      if (Math.abs(near - shards) < 0.01) shards = near;

      const flat = 1 - smooth(0, 0.2, m);
      const f: StoneFrame = {
        vw,
        vh,
        cx,
        cy,
        font,
        stone: stonePx,
        morph: m,
        squeeze: lerp(1, sqMin, smooth(0.05, 0.55, m)),
        depth: lerp(0.004, 0.32, smooth(0, 0.3, m)),
        swell: 0.18 * smooth(0.2, 0.6, m),
        blend: Math.pow(smooth(0.25, 1, m), 1.6),
        yaw: em * (-0.62 + 0.42 * hold) - 0.25 * mid,
        pitch: em * 0.3 + 0.3 * mid,
        roll: em * 0.09 - 0.12 * mid,
        lightX: lx,
        lightY: ly,
        shards,
        flat,
        glow: lerp(1, 0.1, smooth(0, 0.3, m)) * (1 - toDom),
        alpha,
        u: vw / 1470,
      };
      if (!shown) {
        shown = true;
        set(canvas, "visibility", "visible");
      }
      // everything above follows from the scroll position, the boxes and the light
      const key = [u.toFixed(4), cx.toFixed(1), cy.toFixed(1), font.toFixed(2), lx.toFixed(1), ly.toFixed(1), shards.toFixed(2), alpha.toFixed(3), toDom.toFixed(3), vw, vh].join();
      if (key === lastKey && !dirty) {
        renderedPrev = false;
        return;
      }
      lastKey = key;
      dirty = false;

      const sharp = flat > 0.5;
      if (renderedPrev && !sharp) {
        slow = now - lastRender > Math.max(20, 1.6 * minGap) ? slow + 1 : Math.max(0, slow - 1);
        if (slow > 12 && quality > 0.6) {
          quality = Math.max(0.6, quality * 0.8);
          slow = 0;
        }
      }
      lastRender = now;
      renderedPrev = true;
      gl!.setScale(sharp ? Math.min(dpr, 2) : base * quality);
      gl!.render(f);
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      frame(now);
    };
    const start = () => {
      if (running) return;
      running = true;
      lastT = 0;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      // far above the ending: everything at rest
      restNames();
      hideGL();
    };

    const near = new IntersectionObserver((es) => (es.some((e) => e.isIntersecting) ? start() : stop()), {
      rootMargin: "120% 0px 120% 0px",
    });
    near.observe(track);

    // ---- WebGL, on approach ----
    let settle = 0;
    let idle = 0;
    // the one heavy step (compiling the shader) waits for a pause in the scrolling: Safari has
    // no background compile, and a stall mid-scroll would show
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
          if (disposed || now - lastScroll > 220 || now - t0 > 5000) res();
          else window.setTimeout(check, 90);
        };
        check();
      });
    const load = async () => {
      if (disposed || gl) return;
      try {
        const layout = await nameLayout(finalLetters);
        await quiet();
        if (!layout || disposed) return;
        const mod = await import("./gl/stone");
        if (disposed) return;
        const r = await mod.StoneRenderer.create(canvas, layout);
        if (disposed) {
          r?.dispose();
          return;
        }
        gl = r;
        dirty = true;
      } catch {
        gl = null;
      }
    };
    // a lost context (iOS can drop one in the background) falls back to the live names and the
    // still, and draws again once the context is back
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
    ro.observe(canvas);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      near.disconnect();
      approach.disconnect();
      ro.disconnect();
      window.clearTimeout(settle);
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      window.removeEventListener("studio:intro-done", afterIntro);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      restNames();
      delete root.dataset.motion;
      gl?.dispose();
      gl = null;
    };
  }, []);

  return <canvas ref={canvasRef} className={s.canvas} aria-hidden="true" />;
}

// The em layout of the live letters (at rest), for drawing them into the distance field.
async function nameLayout(letters: HTMLElement): Promise<NameLayout | null> {
  const cs = getComputedStyle(letters);
  const weight = cs.fontWeight || "700";
  const family = cs.fontFamily;
  try {
    await document.fonts.load(`${weight} 100px ${family}`);
  } catch {}
  const box = letters.getBoundingClientRect();
  const size = box.height;
  if (!size) return null;
  const chars = Array.from(letters.querySelectorAll<HTMLElement>("[data-ch]"));
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.font = `${weight} 100px ${family}`;
  const m = ctx.measureText("H");
  const A = (m.fontBoundingBoxAscent ?? 96.9) / 100;
  const D = (m.fontBoundingBoxDescent ?? 24.2) / 100;
  return {
    family,
    weight,
    width: box.width / size,
    baseline: (1 - (A + D)) / 2 + A,
    letters: chars.map((c) => ({
      ch: (c.textContent ?? "").toUpperCase(),
      x: (c.getBoundingClientRect().left - box.left) / size,
    })),
  };
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

// The time in Trondheim, filled in on the client.
export function LocalTime({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit" });
    const tick = () => {
      el.textContent = `${fmt.format(new Date())} local time`;
    };
    tick();
    const t = window.setInterval(tick, 20000);
    return () => window.clearInterval(t);
  }, []);
  return <span ref={ref} className={className} />;
}
