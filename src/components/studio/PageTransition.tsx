"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { playSound } from "./sound";
import { IBM_Plex_Mono } from "next/font/google";
import s from "./shell.module.css";
import t from "./PageTransition.module.css";

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

type Phase = "idle" | "prep";
type Mode = "sheet" | "fade" | "aperture";

const SHEET_MS = 650; // paper rises over the old page
const REVEAL_MS = 600; // paper leaves, revealing the new page
const FADE_OUT_MS = 350;
const FADE_IN_MS = 450;
const BULGE = 12; // vh of upward bulge at the start, relaxing to flat
const SHEET_EASE = [0.7, 0, 0.2, 1] as const;
const SHEET_EASE_CSS = "cubic-bezier(0.7, 0, 0.2, 1)";

// cubic-bezier(x1,y1,x2,y2) solver, so the path can follow the same curve CSS would
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const X = (t: number) => ((ax * t + bx) * t + cx) * t;
  const Y = (t: number) => ((ay * t + by) * t + cy) * t;
  const dX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = X(t) - x;
      if (Math.abs(e) < 1e-5) break;
      const d = dX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    return Y(Math.min(1, Math.max(0, t)));
  };
}
const sheetEase = bezier(...SHEET_EASE);

// ---- about: aperture ----
const AP_LINE_MS = 250; // crosshair draws out from the centre
const AP_COVER_DELAY = 120;
const AP_COVER_MS = 560; // paper circle grows from the click point
const AP_OPEN_DELAY = 100;
const AP_OPEN_MS = 640; // ring opens from the centre
const AP_RETRACT_MS = 360;
const LABEL_TOP = "00:00";
const LABEL_BOTTOM = "about";

// viewBox is 100x100 (stretched). Side edges at y=top, centre peaks BULGE*(1-p) higher.
const sheetPath = (p: number) => {
  const top = (100 + BULGE) * (1 - p);
  const b = BULGE * (1 - p);
  return `M0 ${top} Q50 ${top - 2 * b} 100 ${top} L100 101 L0 101 Z`;
};
const FLAT = "M0 0 L100 0 L100 101 L0 101 Z";

export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const prevPath = useRef(pathname);
  const navigating = useRef(false);
  const mode = useRef<Mode>("sheet");
  const timers = useRef<number[]>([]);
  const veilRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const raf = useRef(0);
  const anims = useRef<Animation[]>([]);
  const apRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const lineHRef = useRef<HTMLDivElement>(null);
  const lineVRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const coverAnim = useRef<Animation | null>(null);
  const pageAnim = useRef<Animation | null>(null);
  const origin = useRef<[number, number] | null>(null);

  const hideAperture = () => {
    const el = apRef.current;
    if (el) delete el.dataset.on;
    if (pageRef.current) pageRef.current.style.transformOrigin = "";
    coverAnim.current = null;
    pageAnim.current = null;
  };

  const clearAnims = () => {
    cancelAnimationFrame(raf.current);
    anims.current.forEach((a) => a.cancel());
    anims.current = [];
  };
  const hide = () => {
    clearAnims();
    const v = veilRef.current;
    const sh = sheetRef.current;
    if (v) {
      delete v.dataset.on;
      v.style.opacity = "0";
    }
    hideAperture();
    if (sh) {
      delete sh.dataset.on;
      sh.style.opacity = "";
      sh.style.transform = "";
    }
  };

  // cover the old page; resolves once fully covered
  const coverAperture = () =>
    new Promise<void>((resolve) => {
      const root = apRef.current;
      const cover = coverRef.current;
      const lh = lineHRef.current;
      const lv = lineVRef.current;
      const labels = labelsRef.current;
      const page = pageRef.current;
      if (!root || !cover || !lh || !lv || !labels || !page) return resolve();
      clearAnims();
      const W = window.innerWidth;
      const H = window.innerHeight;
      const [ox, oy] = origin.current ?? [W / 2, H / 2];
      root.dataset.on = "";
      page.style.transformOrigin = `50% ${window.scrollY + H / 2}px`;
      const opts = { fill: "both" as const, easing: SHEET_EASE_CSS };
      const add = (a: Animation) => {
        anims.current.push(a);
        return a;
      };
      add(
        lh.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
          ...opts,
          duration: AP_LINE_MS,
        }),
      );
      add(
        lv.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
          ...opts,
          duration: AP_LINE_MS,
        }),
      );
      add(
        labels.animate([{ opacity: 0 }, { opacity: 1 }], {
          fill: "both",
          easing: "ease-out",
          delay: 100,
          duration: 220,
        }),
      );
      pageAnim.current = add(
        page.animate(
          [
            { transform: "scale(1)", opacity: 1 },
            { transform: "scale(0.97)", opacity: 0.6 },
          ],
          { ...opts, delay: AP_COVER_DELAY, duration: AP_COVER_MS },
        ),
      );
      const ca = add(
        cover.animate(
          [
            { clipPath: `circle(0px at ${ox}px ${oy}px)` },
            { clipPath: `circle(150% at ${ox}px ${oy}px)` },
          ],
          { ...opts, delay: AP_COVER_DELAY, duration: AP_COVER_MS },
        ),
      );
      coverAnim.current = ca;
      ca.finished.then(
        () => resolve(),
        () => undefined,
      );
    });

  // new page is under the cover: crosshair retracts, the cover opens as a ring from the centre
  const revealAperture = () =>
    new Promise<void>((resolve) => {
      const cover = coverRef.current;
      const lh = lineHRef.current;
      const lv = lineVRef.current;
      const labels = labelsRef.current;
      const page = pageRef.current;
      if (!cover || !lh || !lv || !labels || !page) return resolve();
      pageAnim.current?.cancel();
      coverAnim.current?.cancel();
      const W = window.innerWidth;
      const H = window.innerHeight;
      page.style.transformOrigin = `50% ${H / 2}px`;
      const add = (a: Animation) => {
        anims.current.push(a);
        return a;
      };
      add(
        lh.animate(
          [
            { transform: "scaleX(1)", opacity: 1 },
            { transform: "scaleX(0)", opacity: 0 },
          ],
          { fill: "forwards", easing: SHEET_EASE_CSS, duration: AP_RETRACT_MS },
        ),
      );
      add(
        lv.animate(
          [
            { transform: "scaleY(1)", opacity: 1 },
            { transform: "scaleY(0)", opacity: 0 },
          ],
          { fill: "forwards", easing: SHEET_EASE_CSS, duration: AP_RETRACT_MS },
        ),
      );
      add(
        labels.animate([{ opacity: 1 }, { opacity: 0 }], {
          fill: "forwards",
          easing: "ease-in",
          duration: 160,
        }),
      );
      add(
        page.animate(
          [{ transform: "scale(1.02)" }, { transform: "scale(1)" }],
          {
            fill: "both",
            easing: SHEET_EASE_CSS,
            delay: AP_OPEN_DELAY,
            duration: AP_OPEN_MS,
          },
        ),
      );
      cover.style.clipPath = "none";
      const R = Math.hypot(W / 2, H / 2) + 8;
      const a = add(
        cover.animate([{ "--r": "-2px" }, { "--r": `${R}px` }], {
          fill: "forwards",
          easing: SHEET_EASE_CSS,
          delay: AP_OPEN_DELAY,
          duration: AP_OPEN_MS,
        }),
      );
      a.finished.then(
        () => {
          cover.style.clipPath = "";
          resolve();
        },
        () => undefined,
      );
    });

  const cover = (m: Mode) =>
    m === "aperture"
      ? coverAperture()
      : new Promise<void>((resolve) => {
          const v = veilRef.current;
          const sh = sheetRef.current;
          const path = pathRef.current;
          if (!v || !sh || !path) return resolve();
          clearAnims();
          sh.style.transform = "";
          v.dataset.on = "";
          sh.dataset.on = "";
          if (m === "fade") {
            path.setAttribute("d", FLAT);
            v.style.opacity = "0";
            sh.style.opacity = "0";
            const a = sh.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: FADE_OUT_MS,
              easing: "cubic-bezier(0.16, 1, 0.3, 1)",
              fill: "forwards",
            });
            anims.current.push(a);
            a.finished.then(
              () => resolve(),
              () => undefined,
            );
            return;
          }
          sh.style.opacity = "1";
          path.setAttribute("d", sheetPath(0));
          v.style.opacity = "0";
          anims.current.push(
            v.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: SHEET_MS,
              easing: SHEET_EASE_CSS,
              fill: "forwards",
            }),
          );
          const t0 = performance.now();
          const tick = (now: number) => {
            const p = Math.min(1, (now - t0) / SHEET_MS);
            path.setAttribute("d", sheetPath(sheetEase(p)));
            if (p < 1) raf.current = requestAnimationFrame(tick);
            else resolve();
          };
          raf.current = requestAnimationFrame(tick);
        });

  // new page is mounted under the cover: take the cover away
  const reveal = (m: Mode) =>
    m === "aperture"
      ? revealAperture()
      : new Promise<void>((resolve) => {
          const v = veilRef.current;
          const sh = sheetRef.current;
          const path = pathRef.current;
          if (!v || !sh || !path) return resolve();
          cancelAnimationFrame(raf.current);
          path.setAttribute("d", FLAT);
          v.style.opacity = "0";
          delete v.dataset.on;
          const a =
            m === "fade"
              ? sh.animate([{ opacity: 1 }, { opacity: 0 }], {
                  duration: FADE_IN_MS,
                  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
                  fill: "forwards",
                })
              : sh.animate(
                  [
                    { transform: "translateY(0)" },
                    { transform: "translateY(-100%)" },
                  ],
                  {
                    duration: REVEAL_MS,
                    easing: SHEET_EASE_CSS,
                    fill: "forwards",
                  },
                );
          anims.current.push(a);
          a.finished.then(
            () => resolve(),
            () => undefined,
          );
        });

  // intercept internal link clicks: cover, then navigate
  useEffect(() => {
    const reduced = () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (
        !a ||
        a.target ||
        a.hasAttribute("download") ||
        a.dataset.noTransition !== undefined
      )
        return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return; // same page or hash jump
      if (navigating.current) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      origin.current = e.detail > 0 ? [e.clientX, e.clientY] : null;
      playSound("page");
      const dest = url.pathname + url.search + url.hash;
      if (reduced()) {
        router.push(dest);
        return;
      }
      navigating.current = true;
      // going back to the work index is a simple fade; everything else is the sheet wipe
      const dp = url.pathname.replace(/\/$/, "") || "/";
      mode.current =
        dp === "/about"
          ? "aperture"
          : dp === "/work" || dp === "/"
            ? "fade"
            : "sheet";
      window.dispatchEvent(new Event("studio:transition-start"));
      void cover(mode.current).then(() => {
        if (navigating.current) router.push(dest);
      });
      // safety: never leave the page covered if the route does not change
      timers.current.push(
        window.setTimeout(() => {
          if (navigating.current) {
            navigating.current = false;
            hide();
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
      clearAnims();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // route changed: take the cover away (or fade back/forward in) and replay reveals
  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    const viaClick = navigating.current;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let r1 = 0;
    let r2 = 0;
    let t = 0;
    let cancelled = false;
    if (viaClick) {
      // give the new page two frames to paint under the cover, then lift it
      r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => {
          const m = mode.current;
          window.scrollTo(0, 0); // reset under the cover
          const go = () => {
            if (cancelled) return;
            // the arriving page's reveals play as the cover leaves
            t = window.setTimeout(
              () => window.dispatchEvent(new Event("studio:intro-done")),
              m === "fade" ? 80 : 220,
            );
            void reveal(m).then(() => {
              if (cancelled) return;
              hide();
              navigating.current = false;
            });
          };
          go();
        });
      });
    } else if (!reduced) {
      // back/forward: start hidden, then fade in
      r1 = requestAnimationFrame(() => {
        setPhase("prep");
        r2 = requestAnimationFrame(() => setPhase("idle"));
      });
      t = window.setTimeout(
        () => window.dispatchEvent(new Event("studio:intro-done")),
        60,
      );
    } else {
      t = window.setTimeout(
        () => window.dispatchEvent(new Event("studio:intro-done")),
        60,
      );
    }
    return () => {
      cancelled = true;
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      <div ref={pageRef} className={s.page} data-phase={phase}>
        {children}
      </div>
      <div ref={veilRef} className={s.veil} aria-hidden="true" />
      <div
        ref={apRef}
        className={`${t.aperture} ${mono.className}`}
        aria-hidden="true"
      >
        <div ref={coverRef} className={t.cover} />
        <div ref={lineHRef} className={`${t.line} ${t.lineH}`} />
        <div ref={lineVRef} className={`${t.line} ${t.lineV}`} />
        <div ref={labelsRef} className={t.labels}>
          <span className={t.labelTop}>{LABEL_TOP}</span>
          <span className={t.labelBottom}>{LABEL_BOTTOM}</span>
        </div>
      </div>
      <svg
        ref={sheetRef}
        className={s.sheet}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path ref={pathRef} d={FLAT} />
      </svg>
    </>
  );
}
