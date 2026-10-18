"use client";

import { useEffect, type ElementType, useMemo, useRef } from "react";
import styles from "./HoverText.module.css";

const REVERT_MS = 1300;

type Tag = "span" | "p" | "div" | "h1" | "h2" | "h3" | "small" | "strong";
type Segment = { en: string; no: string };

/**
 * Pair English words with the Norwegian words at the same relative position, then merge
 * neighbours until each segment's Norwegian is no longer than its English. Lines can wrap
 * between segments, and a Norwegian phrase never drifts far from the words it translates.
 */
function segment(en: string, no: string): Segment[] {
  const ew = en.split(" ");
  const nw = no.split(" ");
  const starts = (ws: string[], total: number) => {
    let at = 0;
    return ws.map((w) => {
      const f = at / Math.max(1, total);
      at += w.length + 1;
      return f;
    });
  };
  const es = starts(ew, en.length);
  const ns = starts(nw, no.length);
  const groups: string[][] = ew.map(() => []);
  nw.forEach((w, j) => {
    let i = 0;
    while (i + 1 < ew.length && es[i + 1] <= ns[j] + 1e-6) i++;
    groups[i].push(w);
  });
  const out: Segment[] = [];
  let ce: string[] = [];
  let cn: string[] = [];
  ew.forEach((w, i) => {
    ce.push(w);
    cn.push(...groups[i]);
    const e = ce.join(" ");
    const n = cn.join(" ");
    if (cn.length && n.length <= e.length) {
      out.push({ en: e, no: n });
      ce = [];
      cn = [];
    }
  });
  if (ce.length) {
    const last = out.pop();
    if (last) out.push({ en: `${last.en} ${ce.join(" ")}`, no: [last.no, ...cn].filter(Boolean).join(" ") });
    else out.push({ en: ce.join(" "), no: cn.join(" ") });
  }
  return out;
}

const cells = (text: string, cls: string) =>
  Array.from(text).map((ch, i) => (
    <span key={i} className={styles.cell} data-c="">
      <span className={cls}>{ch === " " ? " " : ch}</span>
    </span>
  ));

/**
 * Text in English; the letters under the pointer roll over to Norwegian and roll back
 * shortly after, with the same motion as the landing sheet (HoverTranslate). Both languages
 * keep their own natural spacing: the Norwegian is laid over the English it translates, and
 * a letter flips wherever the pointer covers it, so nothing ever reflows.
 */
export default function HoverText({
  en,
  no,
  className,
  as = "span",
}: {
  en: string;
  no: string;
  className?: string;
  as?: Tag;
}) {
  const ref = useRef<HTMLElement>(null);
  const segs = useMemo(() => segment(en, no), [en, no]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    const flip = (c: HTMLElement) => {
      clearTimeout(timers.get(c));
      timers.delete(c);
      c.dataset.flipped = "";
    };
    const release = (c: HTMLElement) => {
      clearTimeout(timers.get(c));
      timers.set(
        c,
        setTimeout(() => {
          delete c.dataset.flipped;
          timers.delete(c);
        }, REVERT_MS),
      );
    };
    // the English letter under the pointer, plus every Norwegian letter it overlaps (the
    // last English letter also takes any Norwegian that runs past the end of the segment)
    const group = (cell: HTMLElement) => {
      const seg = cell.closest("[data-seg]");
      if (!seg) return [cell];
      const r = cell.getBoundingClientRect();
      const ens = seg.querySelectorAll<HTMLElement>("[data-en] [data-c]");
      const isLast = ens[ens.length - 1] === cell;
      const out = [cell];
      seg.querySelectorAll<HTMLElement>("[data-no] [data-c]").forEach((n) => {
        const q = n.getBoundingClientRect();
        if ((q.right > r.left + 0.5 && q.left < r.right - 0.5) || (isLast && q.left >= r.right - 0.5)) out.push(n);
      });
      return out;
    };
    let current: HTMLElement[] = [];
    let at: HTMLElement | null = null;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const t = (e.target as Element | null)?.closest?.("[data-en] [data-c]") as HTMLElement | null;
      const cell = t && root.contains(t) ? t : null;
      if (cell === at) return;
      at = cell;
      const next = cell ? group(cell) : [];
      current.forEach((c) => !next.includes(c) && release(c));
      next.forEach(flip);
      current = next;
    };
    const onLeave = () => {
      current.forEach(release);
      current = [];
      at = null;
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      timers.forEach(clearTimeout);
    };
  }, []);

  const Tag = as as ElementType;
  return (
    <Tag
      ref={ref}
      className={`${styles.root} ${className ?? ""}`.trim()}
      aria-label={en}
      role={as === "span" ? "text" : undefined}
    >
      <span aria-hidden="true">
        {segs.map((s, i) => (
          <span key={i}>
            {i > 0 ? " " : null}
            <span className={styles.seg} data-seg="">
              <span data-en="">{cells(s.en, styles.en)}</span>
              <span className={styles.noLayer} data-no="" lang="nb">
                {cells(s.no, styles.no)}
              </span>
            </span>
          </span>
        ))}
      </span>
    </Tag>
  );
}
