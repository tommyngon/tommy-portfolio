"use client";

import { useEffect, useRef, useState } from "react";

const SESSION_KEY = "loading-screen-shown";

export default function LoadingScreen() {
  const [count, setCount] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      setHidden(true);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setHidden(true);
      return;
    }

    sessionStorage.setItem(SESSION_KEY, "1");

    const target = 100;
    const duration = 1400;
    const steps = 30;
    const interval = duration / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += target / steps;
      if (current >= target) {
        current = target;
        clearInterval(timer);
        timersRef.current.push(
          setTimeout(() => setExiting(true), 200),
          setTimeout(() => setHidden(true), 700)
        );
      }
      setCount(Math.floor(current));
    }, interval);

    return () => {
      clearInterval(timer);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: "var(--color-ink)",
        color: "var(--color-canvas)",
        clipPath: exiting ? "inset(0 0 100% 0)" : "inset(0)",
        transition: "clip-path 0.5s cubic-bezier(0.65, 0, 0.35, 1)",
      }}
    >
      <div
        className="font-display"
        style={{
          fontSize: "clamp(4rem, 14vw, 14rem)",
          lineHeight: 0.9,
          letterSpacing: "-0.04em",
        }}
      >
        {String(count).padStart(3, "0")}
      </div>
      <div className="absolute bottom-8 left-8 text-mono-meta opacity-60">
        Tommy · Index.001
      </div>
      <div className="absolute bottom-8 right-8 text-mono-meta opacity-60">
        Loading
      </div>
    </div>
  );
}
