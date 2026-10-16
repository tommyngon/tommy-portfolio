"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./PortraitRotator.module.css";

// Four photos on the sides of a square prism. θ only increases, so the head
// turns the same way on every click: front -> right profile -> back -> left.
const faces = [
  { src: "/portrait/front.webp", alt: "Tommy Nguyen, front", yaw: 0, cls: styles.front },
  { src: "/portrait/profile-right-v2.webp", alt: "Tommy Nguyen, right profile", yaw: 90, cls: styles.right },
  { src: "/portrait/back.webp", alt: "Tommy Nguyen, from behind", yaw: 180, cls: styles.back },
  { src: "/portrait/profile-left-v2.webp", alt: "Tommy Nguyen, left profile", yaw: 270, cls: styles.left },
];
const labels = ["Front", "Right profile", "Back", "Left profile"];

const SPIN_DEG_PER_S = 9; // 360deg per 40s
const TURN_MS = 800;
const REDUCED_TURN_MS = 200;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export default function PortraitRotator() {
  const [clicked, setClicked] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const buttonRef = useRef<HTMLButtonElement>(null);
  const cubeRef = useRef<HTMLSpanElement>(null);
  const shadeRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const theta = useRef(0);
  const anim = useRef<{ from: number; to: number; start: number; dur: number } | null>(null);
  const reduced = useRef(false);
  const rafId = useRef(0);
  const lastTs = useRef(0);
  const visible = useRef(true);
  const tickRef = useRef<(ts: number) => void>(() => {});

  const render = useCallback(() => {
    const t = theta.current;
    cubeRef.current?.style.setProperty("--theta", `${t}deg`);
    for (let i = 0; i < faces.length; i++) {
      const c = Math.cos(((t - faces[i].yaw) * Math.PI) / 180);
      const el = shadeRefs.current[i];
      if (el) el.style.opacity = String(0.42 * (1 - Math.max(0, c)));
    }
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = 0;
  }, []);

  const start = useCallback(() => {
    if (rafId.current || !visible.current || document.hidden) return;
    lastTs.current = 0;
    rafId.current = requestAnimationFrame((ts) => tickRef.current(ts));
  }, []);

  useEffect(() => {
    tickRef.current = (ts: number) => {
      rafId.current = 0;
      const dt = lastTs.current ? Math.min((ts - lastTs.current) / 1000, 0.05) : 0;
      lastTs.current = ts;
      const a = anim.current;
      if (a) {
        const p = Math.min((ts - a.start) / a.dur, 1);
        theta.current = a.from + (a.to - a.from) * easeInOutCubic(p);
        if (p >= 1) {
          theta.current = a.to;
          anim.current = null;
          const idx = ((Math.round(a.to / 90) % 4) + 4) % 4;
          setAnnouncement(labels[idx]);
        }
      } else if (!reduced.current) {
        theta.current += SPIN_DEG_PER_S * dt;
      }
      render();
      if (anim.current || !reduced.current) {
        rafId.current = requestAnimationFrame((n) => tickRef.current(n));
      }
    };
  }, [render]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = mq.matches;
    const onMq = () => {
      reduced.current = mq.matches;
      start();
    };
    mq.addEventListener("change", onMq);

    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);

    const io = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      if (entry.isIntersecting) start();
      else stop();
    });
    if (buttonRef.current) io.observe(buttonRef.current);

    render();
    start();

    return () => {
      stop();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      io.disconnect();
    };
  }, [render, start, stop]);

  const advance = () => {
    setClicked(true);
    const cur = theta.current;
    let to = (Math.floor(cur / 90) + 1) * 90;
    if (to - cur < 4) to += 90;
    anim.current = {
      from: cur,
      to,
      start: performance.now(),
      dur: reduced.current ? REDUCED_TURN_MS : TURN_MS,
    };
    stop();
    start();
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`portrait ${styles.root}`}
      onClick={advance}
      aria-label="Rotate portrait to next view"
      data-clicked={clicked || undefined}
    >
      <span className={styles.floor} aria-hidden="true" />
      <span className={styles.cube} ref={cubeRef} aria-hidden="true">
        {faces.map((f, i) => (
          <span key={f.src} className={`${styles.face} ${f.cls}`}>
            <Image
              src={f.src}
              alt={f.alt}
              fill
              sizes="(max-width: 640px) 125px, 150px"
              loading="eager"
              draggable={false}
              className={styles.img}
            />
            <span
              className={styles.shade}
              ref={(el) => {
                shadeRefs.current[i] = el;
              }}
            />
          </span>
        ))}
        <span className={styles.cap} />
      </span>
      <span className={`portrait-cue ${styles.cue}`} aria-hidden="true">
        click to rotate
      </span>
      <span className={styles.srOnly} aria-live="polite">
        {announcement}
      </span>
    </button>
  );
}
