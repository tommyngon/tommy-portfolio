"use client";
// OWNER: agent B. Stub: masked line-by-line text reveal.
export default function RevealLines({ lines, className, delay = 0 }: { lines: string[]; className?: string; delay?: number }) {
  void delay;
  return <span className={className}>{lines.map((l) => <span key={l} style={{ display: "block" }}>{l}</span>)}</span>;
}
