import Image from "next/image";
import Link from "next/link";
import HoverTranslate from "@/components/HoverTranslate";
import { CONTACT, SOCIALS } from "@/lib/site";

// End of the site: a small index, then the button logo and the name set large —
// the way many sites sign off with their mark at the very bottom.
export default function SiteFooter() {
  return (
    <footer id="overview" className="site-footer">
      <div className="site-footer-cols">
        <div>
          <p className="site-footer-h">
            <HoverTranslate en="index" no="indeks" align="start" />
          </p>
          <a href="#portfolio" className="sheet-link">
            <HoverTranslate en="portfolio" no="portefølje" align="start" />
          </a>
          <a href="#qbikk" className="sheet-link">
            qbikk
          </a>
          <Link href="/uniform" className="sheet-link">
            uniform
          </Link>
          <a href="#about" className="sheet-link">
            <HoverTranslate en="about" no="om meg" align="start" />
          </a>
        </div>
        <div>
          <p className="site-footer-h">
            <HoverTranslate en="contact" no="kontakt" align="start" />
          </p>
          <a href={`mailto:${CONTACT.email}`} className="sheet-link">
            {CONTACT.email}
          </a>
          <a href={`tel:${CONTACT.phoneHref}`} className="sheet-link">
            {CONTACT.phone}
          </a>
        </div>
        <div>
          <p className="site-footer-h">
            <HoverTranslate en="follow" no="følg" align="start" />
          </p>
          {SOCIALS.map((s) => (
            <a key={s.label} href={s.href} className="sheet-link" target="_blank" rel="noopener noreferrer">
              {s.label}
            </a>
          ))}
        </div>
        <div>
          <p className="site-footer-h">
            <HoverTranslate en="based in" no="bosatt" align="start" />
          </p>
          <span>
            <HoverTranslate en="trondheim, norway" no="trondheim, norge" align="start" />
          </span>
        </div>
      </div>

      <div className="site-footer-mark">
        <Image
          className="site-footer-logo"
          src="/buttons-mark.png"
          alt="Tommy Ngo Nguyen logo"
          width={480}
          height={475}
          sizes="(max-width: 640px) 34vw, 20vw"
        />
        <p className="site-footer-name" aria-hidden="true">
          tommy ngo nguyen
        </p>
      </div>

      <div className="site-footer-legal">
        <span>© {new Date().getFullYear()} tommy ngo nguyen</span>
        <span>
          {SOCIALS.map((s, i) => (
            <span key={s.label}>
              <a href={s.href} className="sheet-link" target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
              {i < SOCIALS.length - 1 ? ", " : ""}
            </span>
          ))}
        </span>
      </div>
    </footer>
  );
}
