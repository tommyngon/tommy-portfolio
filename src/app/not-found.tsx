import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-canvas text-ink flex items-center justify-center px-6 py-24">
      <div className="max-w-xl w-full">
        <div className="text-mono-meta text-muted mb-8">Error / 404</div>
        <h1 className="font-display text-6xl md:text-7xl mb-6">
          Not&nbsp;found.
        </h1>
        <p className="text-base md:text-lg leading-relaxed mb-10 text-ink/80">
          The page you&apos;re looking for doesn&apos;t exist, or has moved
          somewhere quieter.
        </p>
        <Link
          href="/"
          className="inline-block text-mono-meta border-b border-ink pb-0.5 hover:text-accent hover:border-accent transition-colors"
        >
          ← Return home
        </Link>
      </div>
    </main>
  );
}
