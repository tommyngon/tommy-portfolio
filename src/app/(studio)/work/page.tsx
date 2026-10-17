import type { Metadata } from "next";
import Link from "next/link";
import RevealLines from "@/components/studio/RevealLines";
import Scramble from "@/components/studio/Scramble";
import SeamColumn from "@/components/studio/SeamColumn";
import styles from "@/components/studio/sections.module.css";
import SiteFooter from "@/components/SiteFooter";
import { CONTACT, SOCIALS } from "@/lib/site";
import { GARMENTS } from "@/lib/uniform";
import { COLUMN, PROJECTS } from "@/lib/work";

export const metadata: Metadata = {
  title: "work — Tommy Ngo Nguyen",
  description: "Clothing, software, a company. Selected work by Tommy Ngo Nguyen, Trondheim, Norway.",
};

export default function WorkPage() {
  const year = new Date().getFullYear();
  return (
    <>
      <main id="main" className={styles.page}>
        <h1 className="sr-only">Work — Tommy Ngo Nguyen</h1>
        <div className={`${styles.hero} title-caps`}>
          <RevealLines className={styles.heroL} lines={["Tommy Ngo Nguyen", "Work, 2024–2026"]} delay={400} />
          <RevealLines className={styles.heroR} lines={["Clothing, software,", "a company."]} delay={560} />
          <RevealLines className={styles.heroB} lines={["Trondheim, Norway"]} delay={720} />
        </div>

        <div className={styles.spacer} />
        <div className={styles.column}>
          <SeamColumn items={COLUMN} />
        </div>
        <div className={styles.tail} />

        <nav className={`${styles.index} title-caps`} aria-label="Projects">
          {PROJECTS.map((p, i) => (
            <Link key={p.slug} href={`/work/${p.slug}`}>
              <Scramble text={`${String(i + 1).padStart(2, "0")} ${p.title}`} delay={i * 60} />
            </Link>
          ))}
          {GARMENTS.map((g) => (
            <Link key={g.id} href="/uniform">
              <Scramble text={g.name} delay={180 + Number(g.id) * 40} />
            </Link>
          ))}
        </nav>

        <footer className={styles.footer}>
          <span>Trondheim, Norway</span>
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          {SOCIALS.map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer">
              {s.label}
            </a>
          ))}
          <span>© {year} Tommy Ngo Nguyen</span>
        </footer>
      </main>
      <SiteFooter />
    </>
  );
}
