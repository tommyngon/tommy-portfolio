"use client";

import Image from "next/image";
import Link from "next/link";
import { Fraunces } from "next/font/google";
import { useEffect, useRef, type CSSProperties } from "react";
import { GARMENTS } from "@/lib/uniform";
import s from "./UniformCover.module.css";

// Chapter opener for the söm clothing line: a huge soft-serif wordmark, then a single
// printed sheet with plainly rendered prints (portrait photos stand in for garments).

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

type Print = {
  key: string;
  g: (typeof GARMENTS)[number];
  src: string;
  cls: string;
  sizes: string;
  pos?: string;
};

const PRINTS: Print[] = [
  { key: "a", g: GARMENTS[0], src: "/som/print-front.webp", cls: s.pA, sizes: "(max-width: 900px) 40vw, 24vw" },
  { key: "b", g: GARMENTS[1], src: "/som/print-profile-right.webp", cls: s.pB, sizes: "(max-width: 900px) 28vw, 14vw" },
  { key: "c", g: GARMENTS[2], src: "/som/print-back.webp", cls: s.pC, sizes: "(max-width: 900px) 20vw, 15vw" },
  { key: "d", g: GARMENTS[3], src: "/som/print-profile-left.webp", cls: s.pD, sizes: "(max-width: 900px) 36vw, 22vw" },
  { key: "e", g: GARMENTS[4], src: "/som/print-front-wide.webp", cls: s.pE, sizes: "(max-width: 900px) 24vw, 24vw" },
];

const LETTERS = [
  { ch: "s", cls: s.lS },
  { ch: "ö", cls: s.lO },
  { ch: "m", cls: s.lM },
];

function PrintFig({ p }: { p: Print }) {
  return (
    <Link href="/uniform" className={`${s.print} ${p.cls}`}>
      <span className={s.frame}>
        <Image
          src={p.src}
          alt={`Placeholder photograph for ${p.g.name}`}
          fill
          sizes={p.sizes}
          className={s.img}
        />
      </span>
      <span className={s.cap}>
        <span>{p.g.name}</span>
        <span>{`// ${p.g.id}`}</span>
      </span>
    </Link>
  );
}

export default function UniformCover() {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.inview = "true";
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="uniform" className={s.section} aria-labelledby="som-title">
      <h2 id="som-title" className={s.srOnly}>
        söm — clothing collection by Tommy Ngo Nguyen
      </h2>

      <Link href="/uniform" className={s.wordLink} aria-label="söm — open the catalogue">
        <span className={`${s.word} ${fraunces.className}`} aria-hidden="true">
          söm
        </span>
      </Link>
      <div className={s.sheet} ref={sheetRef}>
        <span className={`${s.num} ${s.nII}`} aria-hidden="true">II</span>
        <span className={`${s.num} ${s.nIII}`} aria-hidden="true">III</span>
        <span className={`${s.num} ${s.nIV}`} aria-hidden="true">IV</span>
        <span className={`${s.num} ${s.nV}`} aria-hidden="true">V</span>
        <span className={`${s.num} ${s.nVI}`} aria-hidden="true">VI</span>
        {PRINTS.map((p) => (
          <PrintFig key={p.key} p={p} />
        ))}
        <div className={s.letters} aria-hidden="true">
          {LETTERS.map((l, i) => (
            <span
              key={l.ch}
              className={`${s.letter} ${l.cls}`}
              style={{ transitionDelay: `${150 + i * 180}ms` } as CSSProperties}
            >
              {l.ch}
            </span>
          ))}
        </div>
        <p className={s.colophon}>
          The name söm is Swedish for seam — the line where two pieces of cloth become one. Every
          garment in the collection is drafted, cut and sewn by hand, one at a time, in small
          numbers. Patterns are redrawn and seams reconsidered until the piece feels inevitable. The
          photographs on this page are placeholders; the garments will take their place.
        </p>
        <span className={s.footSerif} aria-hidden="true">söm — tommy ngo nguyen</span>
        <span className={s.footR} aria-hidden="true">46</span>
      </div>
    </section>
  );
}
