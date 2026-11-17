"use client";
import { useEffect, useRef } from "react";
import s from "./NameLetters.module.css";

export const NAME = "Tommy Ngo Nguyen";

// Each letter sits in its own box (so it can be moved on its own), which drops the font's pair
// kerning; these margins put it back. Inter 700, em, measured per pair in the browser: of
// all the pairs in the name only T-O is kerned.
const KERN: Record<number, number> = { 0: -0.0319 };

const TAU = 0.18; // s, time constant of the sheen's critically damped glide
const FADE_IN = 0.35; // s
const FADE_OUT = 0.7; // s
const SWEEP = 1.1; // s, a tap's single pass from the left edge to the right
const REACH = 2.1; // em, half the band's width (3 sigma), so a sweep starts and ends fully off the name

// The name, one box per letter, each painted in its own two layers (see the css). Under a mouse or
// pen a soft band of lighter, warmer red follows the pointer along the name, like light passing
// over lacquer: nothing moves and the glow does not change, only the fill brightens a little
// inside the letters. It fades in on entering and, on leaving, keeps gliding to a stop while it
// fades out. A tap sends one band across the name, left to right. Reduced motion: no sheen.
export default function NameLetters({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const letters = Array.from(root.querySelectorAll<HTMLElement>("[data-ch]"));
    const wroteX: number[] = letters.map(() => NaN);
    let width = 1; // layout px
    let em = 16;
    let pointer = 0; // where the band is heading, px along the name
    let inside = false;
    let sx = 0;
    let v = 0;
    let a = 0; // 0..1 linear fade, eased before it is written
    let sweep: number | null = null; // start time of a tap's pass
    let wroteSx = NaN;
    let wroteSa = NaN;
    let raf = 0;
    let last = 0;

    const measure = () => {
      const x0 = letters[0]?.offsetLeft ?? 0;
      letters.forEach((l, i) => {
        const x = l.offsetLeft - x0;
        if (x !== wroteX[i]) {
          wroteX[i] = x;
          l.style.setProperty("--x", `${x}px`);
        }
      });
      width = Math.max(1, root.offsetWidth);
      em = root.offsetHeight || 16;
    };

    const write = (x: number, strength: number) => {
      const px = Math.round(x * 10) / 10;
      const sa = Math.round(strength * 1000) / 1000;
      if (px !== wroteSx) {
        wroteSx = px;
        root.style.setProperty("--sx", `${px}px`);
      }
      if (sa !== wroteSa) {
        wroteSa = sa;
        root.style.setProperty("--sa", String(sa));
      }
    };

    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      let busy = true;
      if (sweep !== null) {
        const t = Math.min(1, (now - sweep) / (SWEEP * 1000));
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const from = -REACH * em;
        write(from + (width + REACH * em - from) * e, 1);
        if (t >= 1) {
          sweep = null;
          write(from, 0);
          busy = false;
        }
      } else {
        // critically damped follow: exact for any dt
        const w = 1 / TAU;
        const d = sx - pointer;
        const c = v + w * d;
        const decay = Math.exp(-w * dt);
        sx = pointer + (d + c * dt) * decay;
        v = (v - w * c * dt) * decay;
        a = Math.max(0, Math.min(1, a + (inside ? dt / FADE_IN : -dt / FADE_OUT)));
        const still = Math.abs(sx - pointer) < 0.05 && Math.abs(v) < 0.5;
        if (still) {
          sx = pointer;
          v = 0;
        }
        write(sx, a * a * (3 - 2 * a));
        busy = inside || a > 0 || !still;
      }
      if (busy) raf = requestAnimationFrame(tick);
      else {
        raf = 0;
        last = 0;
      }
    };
    const run = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    // the name may be scaled by an ancestor, so convert screen px back to layout px
    const local = (e: PointerEvent) => {
      const r = root.getBoundingClientRect();
      return (e.clientX - r.left) * (width / Math.max(1, r.width));
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointer = local(e);
      if (!inside) {
        inside = true;
        if (a <= 0.001) {
          sx = pointer;
          v = 0;
        }
      }
      run();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      inside = false;
      run();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      sweep = performance.now();
      a = 0;
      inside = false;
      last = 0;
      run();
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    let alive = true;
    document.fonts?.ready.then(() => alive && measure());
    document.fonts?.addEventListener("loadingdone", measure);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("pointerdown", onDown);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.fonts?.removeEventListener("loadingdone", measure);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointerdown", onDown);
    };
  }, []);

  let li = 0;
  return (
    <span ref={ref} className={`${s.letters} ${className ?? ""}`} data-letters="" aria-hidden="true">
      {Array.from(NAME).map((ch, i) => {
        if (ch === " ")
          return (
            <span key={i} className={s.space}>
              {" "}
            </span>
          );
        const k = KERN[li++];
        return (
          <span key={i} data-ch="" data-g={ch} className={s.ch} style={k ? { marginRight: `${k}em` } : undefined}>
            <span className={s.fill}>{ch}</span>
          </span>
        );
      })}
    </span>
  );
}
