import { IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import HoverTranslate from "@/components/HoverTranslate";
import OverviewMenu from "@/components/OverviewMenu";
import PortraitRotator from "@/components/PortraitRotator";
import { CONTACT, SOCIALS } from "@/lib/site";

const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

// English / Norwegian (bokmål), one entry per printed line. Hovering a letter swaps it
// for the letter in the same position of the Norwegian line.
const PARAGRAPHS: [string, string][][] = [
  [
    ["Clothing, software, a company.", "Klær, programvare, et selskap."],
  ],
  [
    ["Different materials,", "Ulike materialer,"],
    ["the same attention.", "samme oppmerksomhet."],
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
          <span>portfolio</span>
          <OverviewMenu />
          <Link href="/about">
            <HoverTranslate en="about" no="om meg" align="end" />
          </Link>
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
              {CONTACT.email}
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
    </main>
  );
}
