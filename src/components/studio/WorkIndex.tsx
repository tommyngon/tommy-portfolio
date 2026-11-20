"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { LiveKind, Project } from "@/lib/work";
import type { LiveSource } from "./gl/seam";
import Scramble from "./Scramble";
import styles from "./sections.module.css";

export type IndexEntry = { label: string; href: string; cover?: Project["cover"]; no?: string };

// A cover's animation, laid over its still while the name is hovered. The source is created
// on the first hover and only runs while shown. With reduced motion or without WebGL nothing
// mounts and the still stays.
function LivePaper({ kind, mark, on }: { kind: LiveKind; mark?: string; on: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<LiveSource | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!on || !host) return;
    let raf = 0;
    let gone = false;
    const run = (source: LiveSource) => {
      source.hover?.(true); // shown because its name is hovered: the Huskelappen sheets fan out
      source.render(performance.now() / 1000);
      host.dataset.on = "";
      raf = requestAnimationFrame(function tick(now) {
        source.render(now / 1000);
        raf = requestAnimationFrame(tick);
      });
    };
    if (sourceRef.current) run(sourceRef.current);
    else if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      // loaded on the first hover (by then usually cached by the column), off the first page's bundle
      void import("./gl/live").then(({ createLiveSource }) => {
        if (gone || sourceRef.current) return;
        const created = createLiveSource(kind);
        if (!created) return;
        sourceRef.current = created;
        host.appendChild(created.canvas);
        if (mark) {
          const img = document.createElement("img");
          img.src = mark;
          img.alt = "";
          host.appendChild(img);
        }
        run(created);
      });
    return () => {
      gone = true;
      sourceRef.current?.hover?.(false);
      cancelAnimationFrame(raf);
      delete host.dataset.on;
    };
  }, [on, kind, mark]);

  useEffect(() => {
    const host = hostRef.current;
    return () => {
      sourceRef.current?.dispose();
      sourceRef.current = null;
      host?.replaceChildren();
    };
  }, []);

  return <div ref={hostRef} className={styles.endLive} aria-hidden="true" />;
}

// The end of the collection: a quiet grey index; whichever name is under the pointer (or
// reached with the keyboard) turns ink and its sheet appears on the right.
export default function WorkIndex({ entries }: { entries: IndexEntry[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const active = hovered ?? focused;

  return (
    <div className={styles.end}>
      <nav className={`${styles.index} title-caps`} aria-label="Index">
        {entries.map((e, i) => (
          <Link
            key={`${e.href}-${e.label}`}
            href={e.href}
            aria-current={i === active ? "true" : undefined}
            onPointerEnter={(ev) => {
              if (ev.pointerType !== "touch") setHovered(i);
            }}
            onPointerLeave={() => setHovered((h) => (h === i ? null : h))}
            onFocus={(ev) => {
              if (ev.currentTarget.matches(":focus-visible")) setFocused(i);
            }}
            onBlur={() => setFocused((f) => (f === i ? null : f))}
          >
            <Scramble text={e.label} no={e.no} delay={i * 40} />
          </Link>
        ))}
      </nav>
      <figure className={styles.endFigure}>
        {entries.map((e, i) =>
          e.cover ? (
            <Image
              key={`${e.href}-${e.label}`}
              src={e.cover.src}
              alt={i === active ? e.cover.alt : ""}
              aria-hidden={i === active ? undefined : true}
              fill
              loading={i === 0 ? "eager" : undefined} // shares its src with the column's first sheet, which is the LCP
              sizes="(max-width: 640px) 70vw, 22vw"
              className={styles.endImg}
              data-on={i === active ? "" : undefined}
            />
          ) : null,
        )}
        {entries.map((e, i) =>
          e.cover?.live ? (
            <LivePaper key={`live-${e.href}`} kind={e.cover.live} mark={e.cover.mark} on={i === active} />
          ) : null,
        )}
        {active !== null && <figcaption className="sr-only">{entries[active].label}</figcaption>}
      </figure>
    </div>
  );
}
