"use client";
import { useEffect, useRef, useState } from "react";
import { playSound } from "./sound";
import styles from "./sections.module.css";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/+-*#";
const DURATION = 900;

// Text that resolves left-to-right from random glyphs. Starts after the studio intro
// (same trigger as RevealLines) and once scrolled into view.
export default function Scramble({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const [shown, setShown] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
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

    const run = () => {
      const t0 = performance.now();
      let lastTick = 0;
      const frame = (now: number) => {
        const p = Math.min(1, (now - t0) / DURATION);
        const done = Math.floor(p * text.length);
        let out = "";
        for (let i = 0; i < text.length; i++) {
          const c = text[i];
          out += i < done || c === " " ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
        setShown(p >= 1 ? text : out);
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
      timers.push(window.setTimeout(() => setArmed(true), 0));
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
      <span aria-hidden="true">{shown ?? text}</span>
    </span>
  );
}
