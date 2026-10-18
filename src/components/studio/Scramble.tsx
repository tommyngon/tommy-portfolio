"use client";
import { useEffect, useRef, useState } from "react";
import HoverText from "../HoverText";
import { playSound } from "./sound";
import styles from "./sections.module.css";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DURATION = 1300;

// Text that resolves left-to-right from random glyphs. Starts after the studio intro
// (same trigger as RevealLines) and once scrolled into view.
export default function Scramble({ text, no, className, delay = 0 }: { text: string; no?: string; className?: string; delay?: number }) {
  const [shown, setShown] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let introOk = false;
    let seen = false;
    let started = false;
    let raf = 0;
    const timers: number[] = [];

    // Each letter first appears as a random capital (so the line grows from the left),
    // keeps flickering, then settles on its real letter, also from the left.
    const run = () => {
      const t0 = performance.now();
      const n = Math.max(1, text.length);
      let lastTick = 0;
      let lastSwap = -1e9;
      let noise = "";
      const frame = (now: number) => {
        const p = Math.min(1, (now - t0) / DURATION);
        if (now - lastSwap > 70) {
          lastSwap = now;
          noise = Array.from(text, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join("");
        }
        let out = "";
        for (let i = 0; i < text.length; i++) {
          const c = text[i];
          const appear = (i / n) * 0.4;
          const settle = 0.3 + (i / n) * 0.7;
          if (p < appear) break;
          out += p >= settle || c === " " ? c : noise[i];
        }
        setShown(p >= 1 ? text : out);
        if (p >= 1) setDone(true);
        if (p < 1) {
          if (now - lastTick > 120) {
            lastTick = now;
            playSound("tick");
          }
          raf = requestAnimationFrame(frame);
        }
      };
      raf = requestAnimationFrame(frame);
    };
    const maybe = () => {
      if (started || !introOk || !seen) return;
      started = true;
      if (reduce) return;
      timers.push(
        window.setTimeout(() => {
          setArmed(true);
          run();
        }, delay),
      );
    };

    if (reduce) {
      timers.push(window.setTimeout(() => { setArmed(true); setDone(true); }, 0));
      return () => timers.forEach((t) => window.clearTimeout(t));
    }
    const onDone = () => {
      introOk = true;
      maybe();
    };
    window.addEventListener("studio:intro-done", onDone);
    if (document.documentElement.dataset.intro === "done") introOk = true;
    else
      timers.push(
        window.setTimeout(() => {
          if (document.documentElement.dataset.intro !== "running") {
            introOk = true;
            maybe();
          }
        }, 1000),
      );
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        seen = true;
        maybe();
        io.disconnect();
      }
    });
    io.observe(el);
    maybe();
    return () => {
      window.removeEventListener("studio:intro-done", onDone);
      io.disconnect();
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [text, delay]);

  return (
    <span ref={ref} className={`${styles.scramble} ${armed ? styles.scrambleOn : ""} ${className ?? ""}`} aria-label={text} role="text">
      {no && done ? <HoverText en={text} no={no} /> : <span aria-hidden="true">{shown ?? text}</span>}
    </span>
  );
}
