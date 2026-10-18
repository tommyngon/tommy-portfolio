import type { Metadata } from "next";
import Link from "next/link";
import HoverText from "@/components/HoverText";
import GarmentPhoto from "@/components/uniform/GarmentPhoto";
import { GARMENTS } from "@/lib/uniform";
import styles from "./catalogue.module.css";

export const metadata: Metadata = {
  title: "artefakt archive — Tommy Ngo Nguyen",
  description: "artefakt archive: clothing and products drafted, cut and sewn by hand by Tommy Ngo Nguyen.",
};

const TYPE_NO: Record<string, string> = {
  overshirt: "overskjorte",
  "work jacket": "arbeidsjakke",
  tote: "veske",
  cap: "caps",
  trousers: "bukse",
  "t-shirt": "t-skjorte",
  vest: "vest",
  coat: "frakk",
  shorts: "shorts",
};

export default function UniformCatalogue() {
  return (
    <main id="main" className={styles.page}>
      <header className={styles.top}>
        <Link href="/work/artefakt-archive" className={`ui-caps ${styles.back}`}>
          ← artefakt archive
        </Link>
        <h1 className={`title-caps ${styles.title}`}>artefakt archive</h1>
        <p className={`ui-caps ${styles.count}`}>
          <HoverText en={`${GARMENTS.length} pieces`} no={`${GARMENTS.length} plagg`} />
          <br />
          <HoverText en="Drafted, cut and sewn by hand" no="Tegnet, skåret, sydd for hånd" />
        </p>
      </header>
      <ul className={styles.grid}>
        {GARMENTS.map((g) => (
          <li key={g.id} className={styles.item}>
            <GarmentPhoto garment={g} className={styles.photo} sizes="(max-width: 640px) 50vw, 33vw" />
            <p className={styles.caption}>
              <span className="ui-caps">{g.name}</span>
              <span className="ui-caps">{TYPE_NO[g.type] ? <HoverText en={g.type} no={TYPE_NO[g.type]} /> : g.type}</span>
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
