"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties } from "react";
import GarmentPhoto from "@/components/uniform/GarmentPhoto";
import { GARMENTS } from "@/lib/uniform";

// Chapter opener for the clothing line, set like a printed catalogue spread: two studio
// photos, the name scattered letter by letter down the page, and a colophon at the foot.
// Everything links through to the full catalogue at /uniform.

// desktop (x, y) and mobile (mx, my) positions, in % of the section
const LETTERS: { ch: string; x: number; y: number; mx: number; my: number }[] = [
  { ch: "u", x: 91, y: 17, mx: 88, my: 11 },
  { ch: "n", x: 80, y: 26, mx: 74, my: 16 },
  { ch: "i", x: 61, y: 32, mx: 90, my: 21 },
  { ch: "f", x: 77, y: 35, mx: 72, my: 26 },
  { ch: "o", x: 45, y: 38, mx: 86, my: 31 },
  { ch: "r", x: 90, y: 40, mx: 70, my: 36 },
  { ch: "m", x: 63, y: 44, mx: 84, my: 41 },
];

export default function UniformCover() {
  const ref = useRef<HTMLElement>(null);
  const a = GARMENTS[0];
  const b = GARMENTS[1];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.inview = "";
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} id="uniform" className="ucover" aria-labelledby="ucover-title">
      <h2 id="ucover-title" className="sr-only">
        uniform — clothing collection
      </h2>

      <span className="ucover-num ucover-num-top" aria-hidden="true">
        II
      </span>

      <Link href="/uniform" className="ucover-fig ucover-fig-a">
        <GarmentPhoto garment={a} className="ucover-photo ucover-photo-a" sizes="(max-width: 640px) 60vw, 30vw" />
        <span className="ucover-cap">
          <span>
            {a.name} — {a.type}
          </span>
          <span>{`// ${a.id}`}</span>
        </span>
      </Link>

      <div className="ucover-letters" aria-hidden="true">
        {LETTERS.map((l, i) => (
          <span
            key={i}
            className="ucover-letter"
            style={
              {
                "--x": `${l.x}%`,
                "--y": `${l.y}%`,
                "--mx": `${l.mx}%`,
                "--my": `${l.my}%`,
                transitionDelay: `${120 + i * 110}ms`,
              } as CSSProperties
            }
          >
            {l.ch}
          </span>
        ))}
      </div>

      <Link href="/uniform" className="ucover-fig ucover-fig-b">
        <GarmentPhoto garment={b} className="ucover-photo ucover-photo-b" sizes="(max-width: 640px) 72vw, 36vw" />
        <span className="ucover-cap">
          <span>
            {b.name} — {b.type}
          </span>
          <span>{`// ${b.id}`}</span>
        </span>
      </Link>

      <span className="ucover-num ucover-num-bottom" aria-hidden="true">
        III
      </span>

      <div className="ucover-foot">
        <p className="ucover-colophon">
          Every piece in the uniform collection is drafted, cut and sewn by hand. Not a product line but a
          working study — patterns redrawn, seams reconsidered, until the garment feels inevitable.{" "}
          <Link href="/uniform" className="ucover-open">
            Open the catalogue →
          </Link>
        </p>
        <div className="ucover-mast">
          <Link href="/uniform" className="ucover-word">
            uniform
          </Link>
          <span className="ucover-page">02</span>
        </div>
      </div>
    </section>
  );
}
