// TN maker's mark: a high-contrast T and N interlocked inside an oval, drawn as paths so it
// renders identically everywhere.
export default function Monogram({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 104"
      role="img"
      aria-label="TN monogram"
      fill="currentColor"
    >
      <ellipse cx="40" cy="52" rx="37" ry="49" fill="none" stroke="currentColor" strokeWidth="2.2" />

      {/* N — thin stems, heavy diagonal */}
      <rect x="32" y="33" width="1.7" height="44" />
      <polygon points="31.6,32 38.4,32 60.6,80 53.8,80" />
      <rect x="57.2" y="31" width="1.7" height="49" />
      <rect x="27.5" y="31.4" width="11" height="1.6" />
      <rect x="53" y="31.4" width="10" height="1.6" />
      <rect x="27.5" y="76" width="10.5" height="1.6" />

      {/* T — thin bar with bracketed ends, heavy stem, sitting over the N */}
      <rect x="16.5" y="20" width="36" height="1.8" />
      <polygon points="16.5,20 18.6,20 18.1,27.5 16.5,26.2" />
      <polygon points="52.5,20 50.4,20 50.9,27.5 52.5,26.2" />
      <rect x="22.4" y="20" width="6.2" height="44" />
      <rect x="18.8" y="62.4" width="13.4" height="1.6" />
    </svg>
  );
}
