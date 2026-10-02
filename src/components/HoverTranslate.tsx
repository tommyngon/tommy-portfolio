"use client";

import { useEffect, useRef } from "react";

type Align = "start" | "center" | "end";

// Pad a string to `len` cells so both languages occupy the same monospace grid.
function pad(s: string, len: number, align: Align) {
  const gap = len - s.length;
  if (gap <= 0) return s;
  if (align === "start") return s + " ".repeat(gap);
  if (align === "end") return " ".repeat(gap) + s;
  const left = Math.floor(gap / 2);
  return " ".repeat(left) + s + " ".repeat(gap - left);
}

const REVERT_MS = 1300;

/**
 * One line of text, English by default. Each letter the pointer passes over flips to the
 * letter in the same cell of the Norwegian line, then flips back shortly after the pointer
 * leaves. Relies on a monospace font so swapping letters never reflows the line.
 */
export default function HoverTranslate({
  en,
  no,
  align = "center",
  className,
}: {
  en: string;
  no: string;
  align?: Align;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const len = Math.max(en.length, no.length);
  const a = pad(en, len, align);
  const b = pad(no, len, align);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();

    const flip = (cell: Element) => {
      clearTimeout(timers.get(cell));
      timers.delete(cell);
      (cell as HTMLElement).dataset.flipped = "";
    };
    const scheduleRevert = (cell: Element) => {
      clearTimeout(timers.get(cell));
      timers.set(
        cell,
        setTimeout(() => {
          delete (cell as HTMLElement).dataset.flipped;
          timers.delete(cell);
        }, REVERT_MS),
      );
    };
    const cellAt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y)?.closest(".ht-cell");
      return el && root.contains(el) ? el : null;
    };

    // mouse / pen: flip on enter, revert after leaving
    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const cell = (e.target as Element).closest?.(".ht-cell");
      if (cell && root.contains(cell)) flip(cell);
    };
    const onOut = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const cell = (e.target as Element).closest?.(".ht-cell");
      if (cell && root.contains(cell)) scheduleRevert(cell);
    };
    // touch: flip whatever the finger is dragged across
    let lastTouched: Element | null = null;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      const cell = cellAt(e.clientX, e.clientY);
      if (cell && cell !== lastTouched) {
        flip(cell);
        scheduleRevert(cell);
        lastTouched = cell;
      }
    };
    // touch drags start outside this line, so listen on the document
    root.addEventListener("pointerover", onOver);
    root.addEventListener("pointerout", onOut);
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerdown", onMove, { passive: true });

    return () => {
      root.removeEventListener("pointerover", onOver);
      root.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onMove);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <span ref={ref} className={`ht ${className ?? ""}`} lang="en">
      <span className="sr-only">{en}</span>
      <span aria-hidden="true" className="ht-line">
        {Array.from(a).map((ch, i) => {
          const other = b[i];
          if (ch === " " && other === " ") return <span key={i}> </span>;
          return (
            <span key={i} className="ht-cell">
              <span className="ht-en">{ch}</span>
              <span className="ht-no" lang="nb">
                {other}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
