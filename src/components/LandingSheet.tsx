import { IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import HoverTranslate from "@/components/HoverTranslate";
import OverviewMenu from "@/components/OverviewMenu";
import PortraitRotator from "@/components/PortraitRotator";
import SheetContactButton from "@/components/SheetContactButton";
import { LANDING_ONLY } from "@/lib/launch";

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

// The first screen of the site: Tommy's printed sheet. The collection follows below it.
export default function LandingSheet() {
  return (
    <div className={mono.variable}>
        <section className="sheet">
          <h1 className="sr-only">Tommy Ngo Nguyen</h1>

          <nav className="sheet-bar" aria-label="Primary">
            <div>
              <span className="sheet-line">
                <HoverTranslate en="a portfolio" no="en portefølje" align="start" />
              </span>
              <span className="sheet-line">
                <HoverTranslate en="by tommy ngo nguyen" no="av tommy ngo nguyen" align="start" />
              </span>
            </div>
            <OverviewMenu />
            <div>
              {/* the live site is this one page for now, so there is no about page to go to */}
              {LANDING_ONLY ? null : (
                <span className="sheet-line">
                  <Link href="/about">
                    <HoverTranslate en="about" no="om meg" align="end" />
                  </Link>
                </span>
              )}
              <span className="sheet-line">
                <SheetContactButton />
              </span>
            </div>
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
        </section>
    </div>
  );
}
