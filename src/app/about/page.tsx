import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import HoverTranslate from "@/components/HoverTranslate";
import { CONTACT, SOCIALS } from "@/lib/site";
import styles from "./about.module.css";

const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "about — Tommy Ngo Nguyen",
  description:
    "Tommy Ngo Nguyen makes things in three materials: cloth, code and companies. Based in Trondheim, Norway.",
};

const PARAGRAPHS: [string, string][][] = [
  [
    ["I make things in three materials:", "Jeg lager ting i tre materialer:"],
    ["cloth, code and companies.", "stoff, kode og selskaper."],
  ],
  [
    ["The method stays the same —", "Metoden er den samme —"],
    ["begin with the use, then remove", "start med bruken, fjern så"],
    ["everything that isn't needed.", "alt som ikke trengs."],
  ],
  [
    ["Engineering gives me structure,", "Ingeniørfaget gir meg struktur,"],
    ["the workshop gives me patience.", "verkstedet gir meg tålmodighet."],
  ],
];

const WORK = [
  { n: "01", name: "qbikk", kind: "startup", href: "/#qbikk" },
  { n: "02", name: "tomatosharp academy", kind: "onboarding site", href: "/#academy" },
  { n: "03", name: "söm", kind: "clothing", href: "/uniform" },
];

const IDENT: [string, string, string][] = [
  ["name", "navn", "tommy ngo nguyen"],
  ["born", "født", "06.07.1999"],
  ["based", "bosatt", "trondheim, norway"],
];

export default function About() {
  return (
    <main className={`${mono.variable} ${styles.page}`}>
      <h1 className="sr-only">About Tommy Ngo Nguyen</h1>

      <div className={styles.bar}>
        <Link href="/" className="sheet-link">
          ← index
        </Link>
        <span>
          <HoverTranslate en="about" no="om meg" />
        </span>
        <span>tommy ngo nguyen</span>
      </div>

      <div className={styles.portrait}>
        <Image
          src="/portrait/profile-left-v2.webp"
          width={768}
          height={1024}
          sizes="96px"
          alt="Tommy Ngo Nguyen, left profile"
          loading="eager"
        />
      </div>

      <dl className={styles.ident}>
        {IDENT.map(([en, no, value]) => (
          <div key={en} style={{ display: "contents" }}>
            <dt>
              <HoverTranslate en={en} no={no} align="end" />
            </dt>
            <dd>
              <span>:</span>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className={styles.statement}>
        {PARAGRAPHS.map((lines, p) => (
          <p key={p}>
            {lines.map(([en, no], l) => (
              <HoverTranslate key={l} en={en} no={no} />
            ))}
          </p>
        ))}
      </div>

      <section className={styles.work} aria-label="Selected work">
        <h2 className={styles.workHead}>
          <HoverTranslate en="selected work" no="utvalgte arbeid" />
        </h2>
        <ul className={styles.list}>
          {WORK.map((w) => (
            <li key={w.n}>
              <Link href={w.href} className={styles.row}>
                <span className={styles.num}>{w.n}</span>
                <span className={styles.name}>{w.name}</span>
                <span className={styles.kind}>{w.kind}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className={`${styles.bar} ${styles.bottom}`}>
        <address className={styles.contact}>
          <a href={`mailto:${CONTACT.email}`} className="sheet-link">
            {CONTACT.email}
          </a>
        </address>
        <div>
          {SOCIALS.map((s, i) => (
            <span key={s.label}>
              <a href={s.href} className="sheet-link" target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
              {i < SOCIALS.length - 1 ? ", " : ""}
            </span>
          ))}
        </div>
      </footer>
    </main>
  );
}
