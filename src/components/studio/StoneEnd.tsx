import { IBM_Plex_Mono } from "next/font/google";
import HoverText from "../HoverText";
import HoverTranslate from "../HoverTranslate";
import NameLetters from "./NameLetters";
import StoneMotion, { BackToTop, LocalTime } from "./StoneMotion";
import { CONTACT, SOCIALS } from "@/lib/site";
import s from "./StoneEnd.module.css";

// the landing sheet's face, so this statement is set exactly like the first one
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

// English / Norwegian (bokmål), one entry per printed line; hovering a letter flips it, as on
// the landing sheet. DRAFT COPY written from the site's own lines; Tommy to reword.
const LINES: [string, string][] = [
  ["Clothing, software, a company.", "Klær, programvare, et selskap."],
  ["Different materials, held to the same attention:", "Ulike materialer, med samme oppmerksomhet:"],
  ["form that earns its place, function that feels", "form som fortjener plassen, funksjon som føles"],
  ["effortless, and details refined until they speak", "uanstrengt, og detaljer finpusset til de taler"],
  ["a visual language of my own.", "et visuelt språk som er mitt eget."],
];
const CAPTION: [string, string] = ["form, function, attention", "form, funksjon, oppmerksomhet"];

// The end of the home page, one screen: a short statement top-left, a red stone that turns
// slowly (and can be turned by hand), and at the bottom place and contact over the name.
// Scrolling into it, the pinned name's letters gather into the stone; then the footer and the
// large name arrive. The motion lives in StoneMotion (script, WebGL loaded on approach).
// Without it (reduced motion, no script) this is the same screen with a still of the stone.
export default function StoneEnd() {
  const year = new Date().getFullYear();
  return (
    <section className={`${s.end} ${mono.variable}`} data-stone-end="" aria-label="About and contact">
      <div className={s.track} data-k="track">
        <div className={s.stage} data-k="stage">
          <p className={s.text} data-k="text">
            {LINES.map(([en, no], i) => (
              <span key={i} className={s.mask}>
                <span className={s.line} style={{ transitionDelay: `${i * 80}ms` }}>
                  <HoverTranslate en={en} no={no} align="start" />
                </span>
              </span>
            ))}
          </p>

          <div className={s.stone} data-k="stone">
            {/* eslint-disable-next-line @next/next/no-img-element -- a still for when the stone isn't drawn live; next/image would add nothing */}
            <img className={s.still} data-k="still" src="/home/stone.webp" alt="" width={1200} height={1200} loading="lazy" decoding="async" />
            <StoneMotion />
          </div>
          <p className={s.caption} data-k="caption">
            <HoverTranslate en={CAPTION[0]} no={CAPTION[1]} />
          </p>

          <footer className={s.finale} data-k="finale">
            <div className={s.info}>
              <span className={s.rule} data-k="rule" aria-hidden="true" />
              <p className={s.copy} data-reveal="">
                © {year}
              </p>
              <p className={s.place} data-reveal="">
                <HoverText en="Trondheim," no="Trondheim," />
                <br />
                <HoverText en="Norway" no="Norge" />
                <br />
                <LocalTime className={s.muted} />
              </p>
              <p className={s.contact} data-reveal="">
                <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
                {SOCIALS.map((so) => (
                  <span key={so.label}>
                    <br />
                    <a href={so.href} target="_blank" rel="noopener noreferrer">
                      {so.label}
                    </a>
                  </span>
                ))}
              </p>
              <p className={s.top} data-reveal="">
                <BackToTop />
              </p>
            </div>
            <div className={s.finalWrap}>
              <p className={s.name} data-k="final">
                <NameLetters />
              </p>
            </div>
          </footer>
        </div>
      </div>
    </section>
  );
}
