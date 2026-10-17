"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { SeamRenderer } from "./gl/seam";

export type SeamItem = { src: string; alt: string; href: string };

export default function SeamColumn({ items, className }: { items: SeamItem[]; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      if (el) renderer.add({ el, wrap });
    });
    return () => {
      renderer.dispose();
      canvas.style.display = "none";
    };
  }, [items]);

  return (
    <div
      ref={rootRef}
      className={`seam-column ${className ?? ""}`}
      style={{ width: "var(--column-w)", margin: "0 auto", display: "flex", flexDirection: "column" }}
    >
      <style>{`
        .seam-column{gap:60vh}
        @media (max-width:640px){.seam-column{gap:35vh}}
        .seam-column a{display:block}
        .seam-column a:focus-visible{outline:1px solid currentColor;outline-offset:4px}
      `}</style>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ display: "none", position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 1 }}
      />
      {items.map((it) => (
        <Link key={it.src} href={it.href} data-seam>
          <Image
            src={it.src}
            alt={it.alt}
            width={1200}
            height={1500}
            sizes="(max-width: 640px) 70vw, 30vw"
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </Link>
      ))}
    </div>
  );
}
