"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { OrbSource } from "./gl/orb";
import { SeamRenderer } from "./gl/seam";
import css from "./SeamColumn.module.css";

export type SeamItem = { src: string; alt: string; href: string; caption?: string; live?: "orb" };

export default function SeamColumn({ items, className }: { items: SeamItem[]; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const [label, setLabel] = useState(0); // stays put while the caption fades out

  // The caption bottom-right names whichever object is crossing the middle of the screen.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          const i = Number((e.target as HTMLElement).dataset.index);
          if (e.isIntersecting) {
            setCurrent(i);
            setLabel(i);
          }
          else setCurrent((c) => (c === i ? null : c));
        }
      },
      { rootMargin: "-48% 0px -48% 0px" },
    );
    root.querySelectorAll("[data-seam]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const renderer = SeamRenderer.create(canvas);
    if (!renderer) return;
    canvas.style.display = "block";
    root.querySelectorAll<HTMLElement>("[data-seam]").forEach((wrap) => {
      const el = wrap.querySelector("img");
      if (!el) return;
      const live = items[Number(wrap.dataset.index)]?.live === "orb" ? OrbSource.create(512, 640) : null;
      renderer.add({ el, wrap, live: live ?? undefined });
    });
    return () => {
      renderer.dispose();
      canvas.style.display = "none";
    };
  }, [items]);

  return (
    <div ref={rootRef} className={`${css.column} ${className ?? ""}`}>
      <canvas ref={canvasRef} aria-hidden="true" className={css.canvas} />
      {items.map((it, i) => (
        <Link key={it.src} href={it.href} data-seam data-index={i} className={css.item}>
          <Image
            src={it.src}
            alt={it.alt}
            fill
            loading={i === 0 ? "eager" : undefined}
            fetchPriority={i === 0 ? "high" : undefined}
            sizes="(max-width: 640px) 70vw, 32vw"
            className={css.img}
          />
        </Link>
      ))}
      <p className={`${css.caption} ui-caps`} aria-hidden="true" data-on={current !== null && items[current]?.caption ? "" : undefined}>
        {items[label]?.caption}
      </p>
    </div>
  );
}
