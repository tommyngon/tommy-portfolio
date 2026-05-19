"use client";

import { useEffect, useRef, useState } from "react";
import { projects, formatIndex } from "@/lib/projects";
import { LOADING_DURATION } from "@/lib/constants";

export default function SectionIndicator() {
  const [visible, setVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => setVisible(true), LOADING_DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const cards = document.querySelectorAll("[data-tile-id]");
    if (!cards.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter((e) => e.isIntersecting);
        if (!intersecting.length) return;

        // Tie-break: pick the entry whose center is closest to the viewport
        // center; fall back to the greatest intersectionRatio.
        const viewportCenter = window.innerHeight / 2;
        const best = intersecting.reduce((a, b) => {
          const aCenter = a.boundingClientRect.top + a.boundingClientRect.height / 2;
          const bCenter = b.boundingClientRect.top + b.boundingClientRect.height / 2;
          const aDist = Math.abs(aCenter - viewportCenter);
          const bDist = Math.abs(bCenter - viewportCenter);
          if (aDist !== bDist) return aDist < bDist ? a : b;
          return a.intersectionRatio >= b.intersectionRatio ? a : b;
        });

        const id = best.target.getAttribute("data-tile-id");
        if (id !== null) setActiveIndex(parseInt(id, 10));
      },
      { threshold: [0.25, 0.5, 0.75] }
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  const total = String(projects.length).padStart(3, "0");
  const current = formatIndex(activeIndex);
  const project = projects[activeIndex];
  const typeLabel = project?.type === "textile" ? "Textile, Craft" : "Code, Interface";
  const tagsLabel = project?.tags.slice(0, 2).join(", ") ?? "";
  const yearLabel = project?.date.slice(0, 4) ?? "";
  const year = new Date().getFullYear();

  return (
    <>
      {/* Mobile — minimal counter pill */}
      <div
        role="status"
        aria-live="polite"
        aria-label={`Project ${current} of ${total}`}
        className="fixed top-4 right-4 z-30 md:hidden text-mono-meta px-2 py-1 rounded-full"
        style={{
          opacity: visible ? 0.85 : 0,
          background: "color-mix(in oklab, var(--color-paper) 80%, transparent)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          transition: "opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.5s",
        }}
      >
        <span className="flip-mask inline-block overflow-hidden align-middle">
          <span className="flip-inner inline-block" key={`m-${current}`}>
            {current}
          </span>
        </span>
        <span className="mx-1 opacity-65">/</span>
        <span className="align-middle">{total}</span>
      </div>

      {/* Right sidebar — section indicator (desktop) */}
      <aside
        role="status"
        aria-live="polite"
        aria-label={`Current project: ${current} of ${total}, ${typeLabel}`}
        className="fixed right-6 md:right-10 top-1/2 -translate-y-1/2 z-30 hidden md:block text-right"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible
            ? "translate(0, -50%)"
            : "translate(20px, -50%)",
          transition:
            "opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.7s, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.7s",
        }}
      >
        <div className="space-y-1 text-mono-meta" style={{ letterSpacing: "0.04em" }}>
          <span className="flip-mask block overflow-hidden">
            <span className="flip-inner inline-block" key={`type-${typeLabel}`}>
              {typeLabel}
            </span>
          </span>
          <span className="flip-mask block overflow-hidden" style={{ opacity: 0.65 }}>
            <span
              className="flip-inner inline-block"
              key={`tags-${activeIndex}-${tagsLabel}`}
              style={{ animationDelay: "60ms" }}
            >
              {tagsLabel}
            </span>
          </span>
          <span className="flip-mask block overflow-hidden" style={{ opacity: 0.65 }}>
            <span
              className="flip-inner inline-block"
              key={`year-${activeIndex}-${yearLabel}`}
              style={{ animationDelay: "120ms" }}
            >
              {yearLabel}
            </span>
          </span>
        </div>
        <span
          className="flip-mask block overflow-hidden font-display mt-4"
          style={{
            fontSize: "clamp(2.5rem, 4.5vw, 3.5rem)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          <span
            className="flip-inner inline-block"
            key={`current-${current}`}
            style={{ animationDelay: "180ms" }}
          >
            {current}
          </span>
        </span>
      </aside>

      {/* Bottom left — layout label */}
      <div
        aria-hidden="true"
        className="fixed bottom-6 left-6 md:left-10 z-30 hidden md:block text-mono-meta"
        style={{
          opacity: visible ? 0.65 : 0,
          transform: visible ? "translateY(0)" : "translateY(20px)",
          transition:
            "opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.85s, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.85s",
        }}
      >
        Code, Craft, Index
      </div>

      {/* Bottom right — counter + copyright */}
      <div
        className="fixed bottom-6 right-6 md:right-10 z-30 hidden md:block text-right"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(20px)",
          transition:
            "opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.9s, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.9s",
        }}
      >
        <div className="text-mono-meta mb-1" style={{ opacity: 0.65 }}>
          {current} / {total}
        </div>
        <div className="text-mono-meta" style={{ opacity: 0.65 }}>
          &copy; {year} Tommy
        </div>
      </div>

      {/* Decorative brackets */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-20 pointer-events-none hidden md:block"
        style={{
          opacity: visible ? 1 : 0,
          transition: "opacity 1s cubic-bezier(0.16, 1, 0.3, 1) 1s",
        }}
      >
        <div className="relative w-full h-full">
          <span
            className="absolute font-display select-none"
            style={{
              top: "50%",
              left: "calc(50% - min(280px, 32vw))",
              transform: "translate(-100%, -50%)",
              paddingRight: "1.25rem",
              fontSize: "clamp(3rem, 7vw, 5.5rem)",
              lineHeight: 0.8,
              color: "var(--color-ink)",
              animation: "bracketSettle 0.9s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            (
          </span>
          <span
            className="absolute font-display select-none"
            style={{
              top: "50%",
              left: "calc(50% + min(280px, 32vw))",
              transform: "translateY(-50%)",
              paddingLeft: "1.25rem",
              fontSize: "clamp(3rem, 7vw, 5.5rem)",
              lineHeight: 0.8,
              color: "var(--color-ink)",
              animation: "bracketSettle 0.9s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            )
          </span>
        </div>
      </div>
    </>
  );
}
