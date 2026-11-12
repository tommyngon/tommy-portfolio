"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import HoverTranslate from "@/components/HoverTranslate";
import { LANDING_ONLY } from "@/lib/launch";
import styles from "./OverviewMenu.module.css";

const ITEMS = [
  { n: "1", label: "/qbikk", kind: "(startup)", href: "/work/qbikk" },
  {
    n: "2",
    label: "/tomatosharp-academy",
    kind: "(onboarding site)",
    href: "/work/tomatosharp-academy",
  },
  {
    n: "3",
    label: "/stackwise",
    kind: "(tetris skill trainer)",
    href: "/work/stackwise",
  },
  {
    n: "4",
    label: "/staerk",
    kind: "(training logger)",
    href: "/work/staerk",
  },
  {
    n: "5",
    label: "/artefakt-archive",
    kind: "(clothing and products)",
    href: "/work/artefakt-archive",
  },
  {
    n: "6",
    label: "/huskelappen",
    kind: "(application)",
    href: "/work/huskelappen",
  },
];

// The orbit drawing, in viewBox units (0 70 920 470). Solid lines are the near side of the
// figure, dashed lines the far side. Each project sits on a dot placed on one of the curves
// (ellipse point at angle t: cx + rx·cos t, cy + ry·sin t).
const VB = { x: 0, y: 70, w: 920, h: 470 };
const SOLID = [
  { d: "M178 302a282 195 0 1 0 564 0a282 195 0 1 0 -564 0", delay: 0 }, // outer shell
  { d: "M330 158a129 46 0 1 0 258 0a129 46 0 1 0 -258 0", delay: 1 }, // top ring
  { d: "M460 297a78 185 0 1 0 156 0a78 185 0 1 0 -156 0", delay: 2 }, // tall loop
  { d: "M458 298a142 142 0 1 0 284 0a142 142 0 1 0 -284 0", delay: 3 }, // right sphere
];
const DASHED = [
  "M178 294a282 126 0 1 0 564 0a282 126 0 1 0 -564 0", // equator
  "M178 304a140 136 0 1 0 280 0a140 136 0 1 0 -280 0", // left sphere
  "M330 436a129 46 0 1 0 258 0a129 46 0 1 0 -258 0", // bottom ring
];
// the dot each project sits on, and which side its label hangs. The six run clockwise round
// the outer shell, so every label sits on the paper outside the drawing.
const DOTS = [
  { x: 340.8, y: 125.3, side: "up-left" }, // outer shell, upper left
  { x: 641.3, y: 152.6, side: "up-right" }, // outer shell, upper right
  { x: 741.3, y: 288.4, side: "right" }, // outer shell, far right
  { x: 641.3, y: 451.4, side: "down-right" }, // outer shell, lower right
  { x: 340.8, y: 478.7, side: "down-left" }, // outer shell, lower left
  { x: 178.7, y: 315.6, side: "left" }, // outer shell, far left
] as const;
const CENTRE = { x: 458, y: 298 };
const pct = (x: number, y: number) =>
  ({
    left: `${(((x - VB.x) / VB.w) * 100).toFixed(3)}%`,
    top: `${(((y - VB.y) / VB.h) * 100).toFixed(3)}%`,
  }) as const;

const CLOSE_DELAY = 160;

/** `variant="ellipses"` brings back the earlier stack of tilted ellipses. */
export default function OverviewMenu({
  variant = "orbit",
}: {
  variant?: "orbit" | "ellipses";
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clear = () => clearTimeout(timer.current);
  const close = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        btnRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const canHover = () => window.matchMedia("(hover: hover)").matches;

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      data-open={open ? "" : undefined}
      onPointerEnter={(e) => {
        if (e.pointerType === "touch" || !canHover()) return;
        clear();
        setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "touch" || !canHover()) return;
        clear();
        timer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
      }}
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <button
        ref={btnRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="true"
        onClick={(e) => {
          clear();
          // a mouse that can hover has already opened the menu on pointerenter, so its click
          // should keep it open; keyboard (detail 0) and touch taps toggle it
          if (e.detail > 0 && canHover()) setOpen(true);
          else setOpen((o) => !o);
        }}
      >
        <HoverTranslate en="overview" no="oversikt" />
        <span className={styles.mark} aria-hidden="true">
          +
        </span>
      </button>
      {variant === "orbit" ? (
        <div id={id} className={`${styles.panel} ${styles.orbitPanel}`}>
          <div className={styles.orbit}>
            <svg
              className={styles.orbitSvg}
              viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
              aria-hidden="true"
              focusable="false"
            >
              {DASHED.map((d) => (
                <path key={d} d={d} className={styles.dash} />
              ))}
              {SOLID.map((c) => (
                <path
                  key={c.d}
                  d={c.d}
                  pathLength={1}
                  className={styles.line}
                  style={{ "--i": c.delay } as React.CSSProperties}
                />
              ))}
            </svg>
            <span
              className={`${styles.dot} ${styles.centre}`}
              style={pct(CENTRE.x, CENTRE.y)}
              aria-hidden="true"
            />
            <ul className={styles.orbitList}>
              {ITEMS.map((it, i) => {
                const dot = DOTS[i];
                return (
                  <li
                    key={it.href}
                    className={styles.node}
                    data-side={dot.side}
                    style={
                      { ...pct(dot.x, dot.y), "--i": i } as React.CSSProperties
                    }
                  >
                    {/* on the live site the project pages aren't out yet: the
                        names stay, without links */}
                    {LANDING_ONLY ? (
                      <span className={styles.nodeLink}>
                        <span className={styles.dot} aria-hidden="true" />
                        <span className={styles.nodeLabel}>
                          <span className={styles.nodeNum}>{it.n}</span>{" "}
                          {it.label}
                          <span className="sr-only"> {it.kind}</span>
                        </span>
                      </span>
                    ) : (
                      <Link
                        href={it.href}
                        className={styles.nodeLink}
                        onClick={close}
                      >
                        <span className={styles.dot} aria-hidden="true" />
                        <span className={styles.nodeLabel}>
                          <span className={styles.nodeNum}>{it.n}</span>{" "}
                          {it.label}
                          <span className="sr-only"> {it.kind}</span>
                        </span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : (
        <div id={id} className={styles.panel}>
          <ul className={styles.list}>
            {ITEMS.map((it, i) => (
              <li
                key={it.href}
                className={styles.item}
                style={{ "--i": i } as React.CSSProperties}
              >
                <Link href={it.href} className={styles.row} onClick={close}>
                  <svg
                    className={styles.svg}
                    viewBox="0 0 400 190"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <ellipse
                      className={styles.ring}
                      cx="200"
                      cy="95"
                      rx="190"
                      ry="78"
                      transform="rotate(-16 200 95)"
                      pathLength={1}
                    />
                  </svg>
                  <span className={styles.num} aria-hidden="true">
                    {it.n}
                  </span>
                  <span className={styles.text}>
                    <span className={styles.label}>{it.label}</span>
                    <span className={styles.kind}>{it.kind}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
