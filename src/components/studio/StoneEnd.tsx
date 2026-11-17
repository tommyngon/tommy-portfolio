import HoverText from "../HoverText";
import NameLetters from "./NameLetters";
import StoneMotion, { BackToTop, LocalTime } from "./StoneMotion";
import { CONTACT, SOCIALS } from "@/lib/site";
import s from "./StoneEnd.module.css";

// English / Norwegian (bokmål), one entry per printed line; hovering a letter flips it.
// DRAFT COPY written from the site's own lines; Tommy to reword.
const LINES: [string, string][] = [
  ["Clothing, software, a company.", "Klær, programvare, et selskap."],
  ["Different materials, held to the same attention:", "Ulike materialer, med samme oppmerksomhet:"],
  ["form that earns its place, function that feels", "form som fortjener plassen, funksjon som føles"],
  ["effortless, and details refined until they speak", "uanstrengt, og detaljer finpusset til de taler"],
  ["a visual language of my own.", "et visuelt språk som er mitt eget."],
];
const CAPTION = "Form, Function, Attention";

// The end of the home page. Scrolling on from the collection, the pinned name turns into a red
// stone on a slide of its own, with a short statement top-left; scrolling past it, the stone
// turns back into the name, which comes to rest large at the very bottom under place and
// contact. The motion lives in StoneMotion (script, WebGL loaded on approach). Without it
// (reduced motion, no script) this is a plain slide with a still of the stone and a footer.
export default function StoneEnd() {
  const year = new Date().getFullYear();
  return (
    <section className={s.end} data-stone-end="" aria-label="About and contact">
      <StoneMotion />
      <div className={s.track} data-k="track">
        <div className={s.stage} data-k="stage">
          <div className={s.slide} data-k="slide">
            <p className={s.text} data-k="text">
              {LINES.map(([en, no], i) => (
                <span key={i} className={s.mask}>
                  <span className={s.line} style={{ transitionDelay: `${i * 90}ms` }}>
                    <HoverText en={en} no={no} />
                  </span>
                </span>
              ))}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element -- a still for when the stone isn't drawn live; next/image would add nothing */}
            <img className={s.still} data-k="still" src="/home/stone.webp" alt="" width={1200} height={1000} loading="lazy" decoding="async" />
            <p className={s.caption} data-k="caption" aria-hidden="true">
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
            <div className={s.finalWrap} data-k="finalwrap">
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
