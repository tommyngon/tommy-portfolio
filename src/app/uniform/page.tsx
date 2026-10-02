import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import GarmentPhoto from "@/components/uniform/GarmentPhoto";
import { GARMENTS } from "@/lib/uniform";

const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "uniform — catalogue · Tommy Ngo Nguyen",
  description: "uniform: clothing drafted, cut and sewn by hand by Tommy Ngo Nguyen.",
};

// A catalogue page after Hadeland Glassverk's 1965 product catalogue: nine plates on a
// paper sheet, each captioned with the piece's name in bold capitals, page number at the foot.
export default function UniformCatalogue() {
  return (
    <main className={`catalogue ${mono.variable}`}>
      <Link href="/#uniform" className="catalogue-back">
        ← uniform
      </Link>

      <article className="catalogue-sheet" aria-label="uniform catalogue, page 20">
        <h1 className="sr-only">uniform — produktkatalog</h1>
        <ul className="catalogue-grid">
          {GARMENTS.map((g, i) => (
            <li key={g.id} className="catalogue-item" style={{ ["--tilt" as string]: `${((i * 37) % 7) / 10 - 0.3}deg` }}>
              <GarmentPhoto garment={g} className="catalogue-photo" sizes="(max-width: 640px) 45vw, 300px" />
              <p className="catalogue-name">
                {g.name}
                <span className="catalogue-type"> — {g.type}</span>
              </p>
            </li>
          ))}
        </ul>
        <p className="catalogue-folio">20</p>
      </article>
    </main>
  );
}
