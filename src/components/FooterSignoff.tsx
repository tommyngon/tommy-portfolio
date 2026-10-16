"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CONTACT } from "@/lib/site";
import styles from "./FooterSignoff.module.css";

// The site's sign-off: a "Let's talk" ticker over the name set huge in a soft, rounded
// grotesk. The rounding comes from an SVG filter (blur + alpha threshold), which softens
// every corner of the letters the way a rounded typeface would.

const FONT_SIZE = 300; // SVG user units; the viewBox is fitted to the measured text
const TOP = 0.79; // crop above the baseline, in em (just over the ascenders)
// Only the upper half of the name shows: the crop runs through the middle of the
// lowercase letters (Inter's x-height is ~0.55em), so the band's edge cuts it in half.
const BOTTOM = -0.28; // crop below the baseline, in em (negative = above it)

function TickerItem() {
  return (
    <a className={styles.item} href={`mailto:${CONTACT.email}`}>
      <span className={styles.talk}>Let&apos;s talk</span>
      <span className={styles.aside}>
        A garment, an app, an idea?
        <br />
        The first conversation is where it starts.
      </span>
    </a>
  );
}

export default function FooterSignoff() {
  const text = useRef<SVGTextElement>(null);
  const filterId = useId().replace(/:/g, "");
  const [viewBox, setViewBox] = useState(`0 ${FONT_SIZE * (1 - TOP)} 2400 ${FONT_SIZE * (TOP + BOTTOM)}`);

  useEffect(() => {
    const fit = () => {
      const el = text.current;
      if (!el) return;
      const box = el.getBBox();
      const pad = FONT_SIZE * 0.004;
      setViewBox(`${box.x - pad} ${FONT_SIZE * (1 - TOP)} ${box.width + pad * 2} ${FONT_SIZE * (TOP + BOTTOM)}`);
    };
    fit();
    document.fonts?.ready.then(fit);
  }, []);

  return (
    <div className={styles.band}>
      <div className={styles.ticker} aria-label="Let's talk — email Tommy">
        <div className={styles.track}>
          {Array.from({ length: 8 }, (_, i) => (
            <TickerItem key={i} />
          ))}
        </div>
      </div>

      <div className={styles.signature}>
        <svg className={styles.name} viewBox={viewBox} role="img" aria-label="tommy ngo nguyen">
          <defs>
            <filter id={filterId} x="-5%" y="-20%" width="110%" height="140%">
              <feGaussianBlur stdDeviation={FONT_SIZE * 0.022} />
              <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10.5" />
            </filter>
          </defs>
          <text ref={text} x="0" y={FONT_SIZE} fontSize={FONT_SIZE} className={styles.nameText} filter={`url(#${filterId})`}>
            tommy ngo nguyen
          </text>
        </svg>
      </div>
    </div>
  );
}
