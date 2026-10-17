import type { Metadata } from "next";
import Link from "next/link";
import GarmentPhoto from "@/components/uniform/GarmentPhoto";
import { GARMENTS } from "@/lib/uniform";
import styles from "./catalogue.module.css";

export const metadata: Metadata = {
  title: "söm catalogue — Tommy Ngo Nguyen",
  description: "söm: clothing drafted, cut and sewn by hand by Tommy Ngo Nguyen.",
};

export default function UniformCatalogue() {
  return (
    <main id="main" className={styles.page}>
      <Link href="/work/som" className={`ui-caps ${styles.back}`}>
        ← SÖM
      </Link>
      <h1 className="sr-only">söm — produktkatalog</h1>
      <ul className={styles.grid}>
        {GARMENTS.map((g) => (
          <li key={g.id} className={styles.item}>
            <GarmentPhoto garment={g} className={styles.photo} sizes="(max-width: 640px) 50vw, 24vw" />
            <p className={`title-caps ${styles.name}`}>{g.name}</p>
            <p className={styles.meta}>
              {g.id} — {g.type}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
