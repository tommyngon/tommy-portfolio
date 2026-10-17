"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { playSound } from "./sound";
import s from "./shell.module.css";

type Phase = "idle" | "out" | "prep";
const OUT_MS = 400;

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const prevPath = useRef(pathname);
  const navigating = useRef(false);
  const timers = useRef<number[]>([]);

  // intercept internal link clicks: retract, then navigate
  useEffect(() => {
    const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target || a.hasAttribute("download") || a.dataset.noTransition !== undefined) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return; // same page or hash jump
      if (navigating.current) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      playSound("page");
      const dest = url.pathname + url.search + url.hash;
      if (reduced()) {
        router.push(dest);
        return;
      }
      navigating.current = true;
      setPhase("out");
      timers.current.push(window.setTimeout(() => router.push(dest), OUT_MS));
      // safety: never leave the page hidden if the route does not change
      timers.current.push(
        window.setTimeout(() => {
          if (navigating.current) {
            navigating.current = false;
            setPhase("idle");
          }
        }, 4000),
      );
    };
    document.addEventListener("click", onClick, true);
    const list = timers.current;
    return () => {
      document.removeEventListener("click", onClick, true);
      list.forEach(clearTimeout);
    };
  }, [router]);

  // route changed: fade the new page in and replay reveals
  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    const viaClick = navigating.current;
    navigating.current = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let r1 = 0;
    let r2 = 0;
    if (!viaClick && !reduced) {
      // back/forward: start hidden, then fade in
      r1 = requestAnimationFrame(() => {
        setPhase("prep");
        r2 = requestAnimationFrame(() => setPhase("idle"));
      });
    } else {
      r1 = requestAnimationFrame(() => setPhase("idle"));
    }
    const t = window.setTimeout(() => window.dispatchEvent(new Event("studio:intro-done")), 60);
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      window.clearTimeout(t);
    };
  }, [pathname]);

  return (
    <div className={s.page} data-phase={phase}>
      {children}
    </div>
  );
}
