"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import styles from "./AcademyFront.module.css";

const SITE = "https://tomatosharp-academy.vercel.app/";

// Timeline: the section is 100svh (the stage) + INTRO_SVH of scroll; --p runs 0..1 across it.
// The blade wipe (WIPE_FROM..WIPE_TO) is defined in AcademyFront.module.css; keep them in step.
const SHOT_ALT =
  "Tomatosharp Academy front page: 'Et lite snitt. Litt mer kunnskap.' with the knife of the day and three learning levels";
const END_FROM_P = 0.92; // intro progress after which the wipe is done: the pill goes live

// "A small cut." (the academy's own "Et lite snitt.") — a blade of light slices a tomato in
// two, the halves part, and the same blade then cuts down the whole screen, revealing the
// academy's front page. All DOM animation is CSS driven by --p (scroll progress through the section); the
// 3D scene is lazy-loaded.
export default function AcademyFront() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!section || !stage || !canvas) return;

    let disposed = false;
    let visible = false;
    let raf = 0;
    let lastKey = "";
    let scene: { setProgress(p: number): void; dispose(): void } | null = null;

    const compute = () => {
      const rect = section.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      const raw = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
      const p = raw;
      const key = p.toFixed(4);
      if (key !== lastKey) {
        lastKey = key;
        stage.style.setProperty("--p", key);
        stage.dataset.end = p > END_FROM_P ? "1" : "0";
      }
      return p;
    };
    const tick = () => {
      raf = 0;
      if (disposed || !visible) return;
      const p = compute();
      scene?.setProgress(p);
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !raf) raf = requestAnimationFrame(tick);
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(section);
    compute();

    import("./tomato-scene")
      .then(({ createTomatoScene }) => {
        if (disposed) return;
        try {
          scene = createTomatoScene(canvas);
          scene.setProgress(compute());
        } catch {
          canvas.style.display = "none";
        }
      })
      .catch(() => {
        canvas.style.display = "none";
      });

    return () => {
      disposed = true;
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      scene?.dispose();
      scene = null;
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="academy"
      className={styles.slide}
      aria-labelledby="academy-title"
    >
      <h2 id="academy-title" className="sr-only">
        Tomatosharp Academy — front page of the staff onboarding site
      </h2>

      <div ref={stageRef} className={styles.stage} data-end="0">
        <a className={styles.site} href={SITE} target="_blank" rel="noopener noreferrer" aria-label="Open Tomatosharp Academy">
          <Image className={styles.shot} src="/tomatosharp/academy-front.webp" alt={SHOT_ALT} fill sizes="100vw" loading="eager" />
        </a>

        <div className={styles.shadow} />
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        <div className={styles.line} aria-hidden="true" />
        <div className={styles.wipe} aria-hidden="true" />

        <div className={styles.words} aria-hidden="true">
          <div className={`${styles.word} ${styles.word1}`}>
            <span className={styles.serif}>A small cut.</span>
            <span className={styles.gloss}>et lite snitt.</span>
          </div>
          <div className={`${styles.word} ${styles.word2}`}>
            <span className={`${styles.serif} ${styles.italic}`}>A little more knowledge.</span>
            <span className={styles.gloss}>litt mer kunnskap.</span>
          </div>
        </div>

        <span className={styles.hint}>scroll</span>

        <a className={styles.visit} href={SITE} target="_blank" rel="noopener noreferrer">
          tomatosharp academy — visit the site ↗
        </a>
      </div>
    </section>
  );
}
