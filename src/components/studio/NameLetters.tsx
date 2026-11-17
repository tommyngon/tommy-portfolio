"use client";
import { useEffect, useRef } from "react";
import s from "./NameLetters.module.css";

export const NAME = "Tommy Ngo Nguyen";

// Each letter sits in its own box (so it can lift on its own), which drops the font's pair
// kerning; these margins put it back. Inter 700, em, measured per pair in the browser: of
// all the pairs in the name only T-O is kerned.
const KERN: Record<number, number> = { 0: -0.0319 };

const RISE = 0.09; // s, how fast a letter answers the pointer
const FALL = 0.32; // s, how slowly it settles back
const WAVE_SPEED = 9; // letters per second, a tap's ripple
const WAVE_LIFE = 1.5; // s

// The name, one box per letter. Under a mouse or pen the letters nearest the pointer brighten,
// lift a touch and glow a little more, falling off smoothly to either side, so the light seems
// to follow the cursor along the name. A tap sends the same light out from the finger as a
// ripple in both directions. Reduced motion keeps the brightening and drops the lift.
export default function NameLetters({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const letters = Array.from(root.querySelectorAll<HTMLElement>("[data-ch]"));
    const n = letters.length;
    const h = new Float32Array(n);
    const written = new Float32Array(n).fill(-1);
    let centres: number[] = [];
    let unit = 1;
    let pointer: number | null = null;
    let wave: { x: number; t0: number } | null = null;
    let raf = 0;
    let last = 0;

    const measure = () => {
      const left = root.offsetLeft;
      centres = letters.map((l) => l.offsetLeft - left + l.offsetWidth / 2);
      unit = root.offsetWidth / Math.max(1, n);
    };

    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const sigma = unit * 0.95;
      let busy = pointer !== null;
      let w = 0;
      let reach = 0;
      if (wave) {
        const age = (now - wave.t0) / 1000;
        if (age > WAVE_LIFE) wave = null;
        else {
          busy = true;
          w = Math.pow(1 - age / WAVE_LIFE, 1.5);
          reach = age * WAVE_SPEED * unit;
        }
      }
      for (let i = 0; i < n; i++) {
        let target = 0;
        if (pointer !== null) {
          const d = (centres[i] - pointer) / sigma;
          target = Math.exp(-d * d);
        }
        if (wave) {
          const d = (Math.abs(centres[i] - wave.x) - reach) / (sigma * 1.1);
          target = Math.max(target, w * Math.exp(-d * d));
        }
        const k = 1 - Math.exp(-dt / (target > h[i] ? RISE : FALL));
        h[i] += (target - h[i]) * k;
        if (h[i] < 0.002 && target === 0) h[i] = 0;
        else busy = true;
        if (Math.abs(h[i] - written[i]) > 0.002) {
          written[i] = h[i];
          letters[i].style.setProperty("--h", h[i].toFixed(3));
        }
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
    const local = (e: PointerEvent) => e.clientX - root.getBoundingClientRect().left;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (!centres.length) measure();
      pointer = local(e);
      run();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointer = null;
      run();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      measure();
      wave = { x: local(e), t0: performance.now() };
      run();
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("pointerdown", onDown);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
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
          <span key={i} data-ch="" className={s.ch} style={k ? { marginRight: `${k}em` } : undefined}>
            {ch}
          </span>
        );
      })}
    </span>
  );
}
