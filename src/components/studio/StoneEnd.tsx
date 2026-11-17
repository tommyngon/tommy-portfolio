import HoverText from "../HoverText";
import NameLetters from "./NameLetters";
import StoneMotion, { BackToTop } from "./StoneMotion";
import { CONTACT, SOCIALS } from "@/lib/site";
import s from "./StoneEnd.module.css";

// English / Norwegian (bokmål), one entry per printed line; hovering a letter flips it.
// Set like the collection's caption (the serif in capitals). DRAFT COPY written from the
// site's own lines; Tommy to reword.
const LINES: [string, string][] = [
  ["Clothing, software, a company.", "Klær, programvare, et selskap."],
  ["Different materials, held to the same attention:", "Ulike materialer, med samme oppmerksomhet:"],
  ["form that earns its place, function that feels", "form som fortjener plassen, funksjon som føles"],
  ["effortless, and details refined until they speak", "uanstrengt, og detaljer finpusset til de taler"],
  ["a visual language of my own.", "et visuelt språk som er mitt eget."],
];
const CAPTION = "Form, Function, Attention";

// The end of the home page, one screen: a short statement top-left, a rough red stone that
// turns slowly (and can be turned by hand) with its caption across it, and at the bottom place
// and contact over the name. With motion the name at the bottom is the pinned one itself: it
// follows the page all the way down, then grows and settles into this place, while the stone
// comes into focus. The motion lives in StoneMotion (script, WebGL loaded on approach).
// Without it (reduced motion, no script) this is the same screen with a still of the stone.
export default function StoneEnd() {
  const year = new Date().getFullYear();
  return (
    <section className={s.end} data-stone-end="" aria-label="About and contact">
      <div className={s.track} data-k="track">
        <div className={s.stage} data-k="stage">
          <p className={`${s.text} title-caps`} data-k="text">
            {LINES.map(([en, no], i) => (
              <span key={i} className={s.mask}>
                <span className={s.line} style={{ transitionDelay: `${i * 80}ms` }}>
                  <HoverText en={en} no={no} />
                </span>
              </span>
            ))}
          </p>

          <div className={s.stone} data-k="stone">
            {/* eslint-disable-next-line @next/next/no-img-element -- a still for when the stone isn't drawn live; next/image would add nothing */}
            <img className={s.still} data-k="still" src="/home/stone.webp" alt="" width={1200} height={1200} loading="lazy" decoding="async" />
            <StoneMotion />
            <p className={`${s.caption} title-caps`} data-k="caption">
              {CAPTION}
            </p>
          </div>

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
