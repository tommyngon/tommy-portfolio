"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

// Lenis smooth scroll for every studio page. Native scrolling under prefers-reduced-motion.
// Other components pause it with a window CustomEvent "studio:scroll-lock" {detail: boolean}.
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let locked = false;

    const stop = () => {
      cancelAnimationFrame(raf);
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
    const start = () => {
      if (lenisRef.current || mq.matches) return;
      const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
      lenisRef.current = lenis;
      if (locked) lenis.stop();
      const tick = (t: number) => {
        lenis.raf(t);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const onLock = (e: Event) => {
      locked = Boolean((e as CustomEvent<boolean>).detail);
      if (locked) lenisRef.current?.stop();
      else lenisRef.current?.start();
    };
    const onMq = () => (mq.matches ? stop() : start());

    start();
    window.addEventListener("studio:scroll-lock", onLock);
    mq.addEventListener("change", onMq);
    return () => {
      window.removeEventListener("studio:scroll-lock", onLock);
      mq.removeEventListener("change", onMq);
      stop();
    };
  }, []);

  // new page → top
  useEffect(() => {
    if (lenisRef.current) lenisRef.current.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo(0, 0);
  }, [pathname]);

  return <>{children}</>;
}
