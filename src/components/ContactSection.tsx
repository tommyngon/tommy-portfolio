import { CONTACT_EMAIL } from "@/lib/constants";

export default function ContactSection() {
  return (
    <section className="pb-32">
      <div
        className="border-t border-b py-12"
        style={{ borderColor: "var(--color-ink)" }}
      >
        <div className="text-mono-meta opacity-65 mb-6">Contact</div>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="font-display block transition-colors duration-500 hover:text-[color:var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)] rounded-sm"
          style={{
            fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
            wordBreak: "break-word",
          }}
        >
          {CONTACT_EMAIL}
        </a>
        <div className="mt-8 text-mono-meta opacity-65">
          Oslo &middot; Remote
        </div>
      </div>
    </section>
  );
}
