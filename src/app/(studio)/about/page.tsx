import type { Metadata } from "next";
import Image from "next/image";
import { CONTACT, SOCIALS } from "@/lib/site";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "about — Tommy Ngo Nguyen",
  description: "Tommy Ngo Nguyen, head of product at QBIKK. Makes clothing and products as artefakt archive. Based in Trondheim, Norway.",
};

const BIO_EN =
  "Tommy Ngo Nguyen works across cloth, code and companies, treating each as a different grammar for the same question: how an object earns its place in daily life. Since 2024 he has drafted, cut and sewn garments by hand for artefakt archive, a growing record of clothing and products studied at the line where structure meets the body. As head of product at QBIKK he shapes a pocket-sized memory, an attempt to make software feel less like a tool and more like recall; with Huskelappen, an application, the work continues in software. For the knife store where he works, he built Tomatosharp Academy, turning craft knowledge into something that can be taught and passed on. Based in Trondheim, Norway, his practice is an ongoing study of form, function and a visual language of its own: different materials, the same attention.";
const HANDLES: Record<string, string> = { instagram: "@tommy.nn", linkedin: "/tommyngonguyen" };

export default function AboutPage() {
  return (
    <main id="main" className={styles.page}>
      <h1 className="sr-only">About Tommy Ngo Nguyen</h1>
      <div className={styles.photo}>
        <Image src="/portrait/front.webp" alt="Tommy Ngo Nguyen" fill loading="eager" fetchPriority="high" sizes="(max-width: 640px) 100vw, 50vw" />
      </div>

      <p className={`${styles.label} title-caps`}>
        Tommy Ngo
        <br />
        Nguyen
      </p>
      <div className={`${styles.body} title-caps`}>
        <p>{BIO_EN}</p>
      </div>

      <footer className={styles.footer}>
        <p className={styles.place}>
          Trondheim,
          <br />
          Norway
        </p>
        <p className={styles.links}>
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          {SOCIALS.map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
              {HANDLES[l.label] ?? l.label}
            </a>
          ))}
        </p>
        <p className={styles.credit}>
          Photos, animation and visuals by
          <br />
          Tommy Ngo Nguyen with Claude
          <br />
          Website by <span className={styles.signature}>Tommy Ngo Nguyen</span>
        </p>
      </footer>
    </main>
  );
}
