"use client";
// OWNER: agent B. Stub: text that resolves from random glyphs.
export default function Scramble({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  void delay;
  return <span className={className}>{text}</span>;
}
