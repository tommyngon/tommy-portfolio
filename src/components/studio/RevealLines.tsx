"use client";
import { useEffect, useState } from "react";
import styles from "./sections.module.css";

// Masked line-by-line reveal. Starts `delay` ms after the studio intro finishes
// (immediately when the intro already ran, or when no preloader shows up within 1 s).
export default function RevealLines({ lines, className, delay = 0 }: { lines: string[]; className?: string; delay?: number }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    let started = false;
    const timers: number[] = [];
    const go = () => {
      if (started) return;
      started = true;
      timers.push(window.setTimeout(() => setOn(true), delay));
    };
    const onDone = () => go();
    window.addEventListener("studio:intro-done", onDone);
    const state = document.documentElement.dataset.intro;
    if (state === "done") go();
    else
      timers.push(
        window.setTimeout(() => {
          if (document.documentElement.dataset.intro !== "running") go();
        }, 1000),
      );
    return () => {
      window.removeEventListener("studio:intro-done", onDone);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [delay]);

  return (
    <span className={`${styles.reveal} ${on ? styles.revealOn : ""} ${className ?? ""}`} aria-label={lines.join(" ")} role="text">
      {lines.map((l, i) => (
        <span key={`${i}-${l}`} className={styles.mask} aria-hidden="true">
          <span className={styles.line} style={{ transitionDelay: `${i * 80}ms` }}>
            {l}
          </span>
        </span>
      ))}
    </span>
  );
}
