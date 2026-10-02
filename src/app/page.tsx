import { IBM_Plex_Mono } from "next/font/google";
import HoverTranslate from "@/components/HoverTranslate";
import PortraitRotator from "@/components/PortraitRotator";
import SiteFooter from "@/components/SiteFooter";
import QbikkSection from "@/components/qbikk/QbikkSection";
import UniformCover from "@/components/uniform/UniformCover";
import { CONTACT, SOCIALS } from "@/lib/site";

const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

// English / Norwegian (bokmål), one entry per printed line. Hovering a letter swaps it
// for the letter in the same position of the Norwegian line.
const PARAGRAPHS: [string, string][][] = [
  [
    ["This is where design, product,", "Her møtes design, produkt"],
    ["and clothing meet.", "og klær."],
  ],
  [
    ["Here are my collections, apps,", "Her er mine kolleksjoner, apper"],
    ["and startup —", "og oppstart —"],
    ["process, decisions, detail.", "prosess, valg, detaljer."],
  ],
  [
    ["An ongoing study of form, function,", "En pågående studie av form, funksjon"],
    ["and my own visual language.", "og mitt eget visuelle språk."],
  ],
];

export default function Home() {
  return (
    <main className={mono.variable}>
      <section className="sheet">
        <h1 className="sr-only">Tommy Ngo Nguyen</h1>

        <nav className="sheet-bar" aria-label="Primary">
          <a href="#portfolio" className="sheet-link">
            <HoverTranslate en="portfolio" no="portefølje" align="start" />
          </a>
          <a href="#overview" className="sheet-link">
            <HoverTranslate en="overview" no="oversikt" />
          </a>
          <a href="#about" className="sheet-link">
            <HoverTranslate en="about" no="om meg" align="end" />
          </a>
        </nav>

        <div className="sheet-portrait">
          <PortraitRotator />
        </div>

        <div className="sheet-text">
          <dl className="ident">
            <dt>
              <HoverTranslate en="name" no="navn" align="end" />
            </dt>
            <dd>
              <span className="ident-colon">:</span> tommy ngo nguyen
            </dd>
            <dt>
              <HoverTranslate en="born" no="født" align="end" />
            </dt>
            <dd>
              <span className="ident-colon">:</span> 06.07.1999
            </dd>
          </dl>

          <div className="statement">
            {PARAGRAPHS.map((lines, p) => (
              <p key={p}>
                {lines.map(([en, no], l) => (
                  <HoverTranslate key={l} en={en} no={no} />
                ))}
              </p>
            ))}
          </div>
        </div>

        <footer className="sheet-bar sheet-bar-bottom">
          <address className="sheet-contact">
            <a href={`mailto:${CONTACT.email}`} className="sheet-link">
              E: {CONTACT.email}
            </a>
            <a href={`tel:${CONTACT.phoneHref}`} className="sheet-link">
              P: {CONTACT.phone}
            </a>
          </address>
          <div className="sheet-socials">
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
      </section>

      <div id="portfolio">
        <QbikkSection />
        <UniformCover />
      </div>

      <SiteFooter />
    </main>
  );
}
