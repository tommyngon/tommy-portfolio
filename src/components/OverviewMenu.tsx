"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import HoverTranslate from "@/components/HoverTranslate";
import styles from "./OverviewMenu.module.css";

const ITEMS = [
  { n: "01", label: "qbikk", kind: "startup", href: "#qbikk" },
  { n: "02", label: "tomatosharp academy", kind: "onboarding site", href: "#academy" },
  { n: "03", label: "söm", kind: "clothing", href: "#uniform" },
];

const CLOSE_DELAY = 160;

export default function OverviewMenu() {
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
      <div id={id} className={styles.panel}>
        <ul className={styles.list}>
          {ITEMS.map((it, i) => (
            <li key={it.href} className={styles.item} style={{ "--i": i } as React.CSSProperties}>
              <a href={it.href} className={styles.row} onClick={close}>
                <span className={styles.num}>{it.n}</span>
                <span className={styles.label}>{it.label}</span>
                <span className={styles.kind}>{it.kind}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
