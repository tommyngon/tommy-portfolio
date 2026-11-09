"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { LiveKind } from "@/lib/work";
import { createLiveSource } from "./gl/live";
import { SeamRenderer } from "./gl/seam";
import css from "./SeamColumn.module.css";

export type SeamItem = { src: string; alt: string; href: string; caption?: string; live?: LiveKind; mark?: string };

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

  // The GL column waits until the intro has played out and the column is close to the
  // viewport, so its context, shaders and uploads never compete with the intro.
  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let renderer: SeamRenderer | null = null;
    let cancelled = false;
    let idle = 0;
    let settle = 0;
    const start = () => {
      if (cancelled || renderer) return;
      renderer = SeamRenderer.create(canvas);
      if (!renderer) return;
      root.querySelectorAll<HTMLElement>("[data-seam]").forEach((wrap) => {
        const el = wrap.querySelector("img");
        if (!el) return;
        const item = items[Number(wrap.dataset.index)];
        renderer!.add({
          el,
          wrap,
          live: item?.live ? () => createLiveSource(item.live!) : undefined,
          mark: item?.live ? item.mark : undefined,
        });
      });
    };
    const whenIdle = () => {
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(start, { timeout: 200 });
      else idle = window.setTimeout(start, 80);
    };
    const near = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          near.disconnect();
          whenIdle();
        }
      },
      { rootMargin: "200% 0px 200% 0px" },
    );
    const watch = () => near.observe(root);
    // the event fires as the overlay starts to fade: give the fade and the first reveals the frames first
    const afterIntro = () => {
      settle = window.setTimeout(watch, 700);
    };
    if (document.documentElement.dataset.intro === "running") window.addEventListener("studio:intro-done", afterIntro, { once: true });
    else watch();
    return () => {
      cancelled = true;
      window.removeEventListener("studio:intro-done", afterIntro);
      window.clearTimeout(settle);
      near.disconnect();
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      renderer?.dispose();
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
