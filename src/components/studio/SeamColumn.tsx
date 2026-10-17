"use client";
// OWNER: agent C. Stub: the WebGL "seam bend" image column.
export type SeamItem = { src: string; alt: string; href: string };
export default function SeamColumn({ items, className }: { items: SeamItem[]; className?: string }) {
  return <div className={className}>{items.map((i) => <a key={i.src} href={i.href}>{i.alt}</a>)}</div>;
}
