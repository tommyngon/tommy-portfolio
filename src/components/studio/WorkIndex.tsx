"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import Scramble from "./Scramble";
import styles from "./sections.module.css";

export type IndexEntry = { label: string; href: string; image?: { src: string; alt: string }; no?: string };

// The end of the collection: a quiet grey index; whichever name is under the pointer
// turns ink and its object appears on the right.
export default function WorkIndex({ entries }: { entries: IndexEntry[] }) {
  const [active, setActive] = useState(0);
  const current = entries[active];
  // entries without an image keep the nearest earlier picture on show
  let shown = active;
  while (shown > 0 && !entries[shown].image) shown--;

  return (
    <div className={styles.end}>
      <nav className={`${styles.index} title-caps`} aria-label="Index">
        {entries.map((e, i) => (
          <Link
            key={`${e.href}-${e.label}`}
            href={e.href}
            aria-current={i === active ? "true" : undefined}
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
          >
            <Scramble text={e.label} no={e.no} delay={i * 40} />
          </Link>
        ))}
      </nav>
      <figure className={styles.endFigure}>
        {entries.map((e, i) =>
          e.image ? (
          <Image
            key={`${e.href}-${e.label}`}
            src={e.image.src}
            alt={i === shown ? e.image.alt : ""}
            aria-hidden={i === shown ? undefined : true}
            fill
            sizes="(max-width: 640px) 70vw, 22vw"
            className={styles.endImg}
            data-on={i === shown ? "" : undefined}
          />
          ) : null,
        )}
        <figcaption className="sr-only">{current.label}</figcaption>
      </figure>
    </div>
  );
}
