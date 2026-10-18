import HoverText from "../HoverText";
import Scramble from "./Scramble";
import SeamColumn from "./SeamColumn";
import WorkIndex, { type IndexEntry } from "./WorkIndex";
import styles from "./sections.module.css";
import { CONTACT, SOCIALS } from "@/lib/site";
import { GARMENTS } from "@/lib/uniform";
import { COLUMN, PROJECTS } from "@/lib/work";

const SOM = PROJECTS.find((p) => p.slug === "artefakt-archive")?.images ?? [];

const ENTRIES: IndexEntry[] = [
  ...PROJECTS.map((p, i) => ({
    label: `${String(i + 1).padStart(2, "0")} ${p.title.toUpperCase()}`,
    href: `/work/${p.slug}`,
    image: p.images?.[0], // no image: the hover keeps the previous one
  })),
  // garments have no photographs yet; they borrow the artefakt archive prints until they do
  ...GARMENTS.map((g, i) => ({
    label: g.name,
    href: "/uniform",
    image: g.photo ? { src: g.photo, alt: `${g.name}, ${g.type}` } : SOM[i % SOM.length],
  })),
];

// The collection: fixed serif block, the bending column, the index and the footer.
export default function Collection() {
  const year = new Date().getFullYear();
  return (
    <section className={styles.page} aria-label="Work">
      {/* a printed caption: five lines on two tab stops, like a gallery wall label */}
      <div className={`${styles.hero} title-caps`} aria-hidden="true">
        <span className={styles.heroRow}>
          <Scramble text="My projects" no="Prosjekter" />
          <Scramble className={styles.tab1} text="The same attention" no="Samme oppmerksomhet" delay={80} />
        </span>
        <span className={styles.heroRow}>
          <Scramble text="Trondheim, Norway, since 2024" no="Trondheim, Norge, siden 2024" delay={160} />
        </span>
        <span className={`${styles.heroRow} ${styles.tab2}`}>
          <Scramble text="QBIKK, Tomatosharp," delay={240} />
        </span>
        <span className={`${styles.heroRow} ${styles.tab2}`}>
          <Scramble text="artefakt archive, Huskelappen" delay={300} />
        </span>
        <span className={styles.heroRow}>
          <Scramble text="Please explore my headspace" no="Utforsk gjerne tankene mine" delay={380} />
        </span>
      </div>
      <p className="sr-only">My projects — the same attention. Trondheim, Norway, since 2024. QBIKK, Tomatosharp, artefakt archive, Huskelappen. Please explore my headspace.</p>

      <div className={styles.spacer} />
      <div className={styles.column}>
        <SeamColumn items={COLUMN} />
      </div>
      <div className={styles.tail} />

      <WorkIndex entries={ENTRIES} />

      <footer className={styles.footer}>
        <p className={styles.footA}>
          <HoverText en="Trondheim," no="Trondheim," />
          <br />
          <HoverText en="Norway" no="Norge" />
        </p>
        <p className={styles.footB}>
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          {SOCIALS.map((s) => (
            <span key={s.label}>
              <br />
              <a href={s.href} target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
            </span>
          ))}
        </p>
        <p className={styles.footC}>
          <HoverText en="Design and code by Tommy Ngo Nguyen" no="Design og kode av Tommy Ngo Nguyen" />
          <br />© {year}
        </p>
      </footer>
    </section>
  );
}
