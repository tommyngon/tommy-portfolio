import type { Metadata } from "next";
import Link from "next/link";
import RevealLines from "@/components/studio/RevealLines";
import Scramble from "@/components/studio/Scramble";
import SeamColumn from "@/components/studio/SeamColumn";
import styles from "@/components/studio/sections.module.css";
import { PROJECTS } from "@/lib/work";

export const metadata: Metadata = {
  title: "about — Tommy Ngo Nguyen",
  description: "Tommy Ngo Nguyen, head of product at QBIKK. Makes clothing as söm. Based in Trondheim, Norway.",
};

const PORTRAITS = [
  { src: "/portrait/front.webp", alt: "Tommy Ngo Nguyen, front", href: "/about" },
  { src: "/portrait/profile-right-v2.webp", alt: "Tommy Ngo Nguyen, right profile", href: "/about" },
  { src: "/portrait/back.webp", alt: "Tommy Ngo Nguyen, from behind", href: "/about" },
  { src: "/portrait/profile-left-v2.webp", alt: "Tommy Ngo Nguyen, left profile", href: "/about" },
];

export default function AboutPage() {
  return (
    <main id="main">
      <h1 className="sr-only">About Tommy Ngo Nguyen</h1>
      <div className={`${styles.aboutHero} title-caps`}>
        <div className={styles.bio}>
          <RevealLines
            delay={400}
            lines={["Tommy Ngo Nguyen. Head of product", "at QBIKK. Makes clothing under the", "name söm since 2024. Built", "Tomatosharp Academy for the knife", "store where he works. Based in", "Trondheim, Norway."]}
          />
        </div>
        <div className={styles.bio}>
          <RevealLines delay={900} lines={["Clothing, software, a company.", "Different materials, the same", "attention."]} />
        </div>
      </div>

      <div className={styles.aboutColumn}>
        <SeamColumn items={PORTRAITS} />
      </div>
      <p className={`${styles.caption} ui-caps`}>Portraits — Tommy Ngo Nguyen</p>

      <section className={styles.selected} aria-label="Selected work">
        <h2 className={`${styles.selectedHead} ui-caps`}>Selected work</h2>
        <ul className="title-caps">
          {PROJECTS.map((p, i) => (
            <li key={p.slug}>
              <Link href={`/work/${p.slug}`}>
                <Scramble text={`${String(i + 1).padStart(2, "0")} ${p.title}`} delay={i * 80} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
