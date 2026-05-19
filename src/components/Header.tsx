"use client";

import { useEffect, useRef, useState } from "react";
import { LOADING_DURATION, CONTACT_EMAIL } from "@/lib/constants";

export default function Header() {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => setVisible(true), LOADING_DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <>
      {/* Logo — top left */}
      <div
        className="fixed top-6 md:top-8 left-6 md:left-10 z-40 font-display select-none"
        style={{
          fontSize: "clamp(1.75rem, 2.4vw, 2.25rem)",
          letterSpacing: "-0.02em",
          lineHeight: 1,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(-20px)",
          transition:
            "opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.3s, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.3s",
        }}
      >
        Tommy<span style={{ color: "var(--color-accent)" }}>&reg;</span>
      </div>

      {/* Bio + Nav — top right */}
      <div
        className="fixed top-6 md:top-8 right-6 md:right-10 z-40 text-right hidden md:block max-w-[260px]"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(-20px)",
          transition:
            "opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.4s, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.4s",
        }}
      >
        <nav
          className="text-mono-meta opacity-65 mb-3 flex justify-end gap-4"
          aria-label="Primary"
        >
          <a
            href="#work"
            className="transition-colors hover:text-[color:var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)] rounded-sm"
          >
            Work
          </a>
          <a
            href="#about"
            className="transition-colors hover:text-[color:var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)] rounded-sm"
          >
            About
          </a>
        </nav>
        <p id="about" className="text-[13px] leading-snug">
          Tommy is a developer and maker based in Oslo. Building software and
          sewing garments with the same precision.
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-mono-meta mt-3 inline-block transition-colors hover:text-[color:var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)] rounded-sm"
          style={{ textTransform: "none", letterSpacing: 0 }}
        >
          {CONTACT_EMAIL}
        </a>
      </div>
    </>
  );
}
