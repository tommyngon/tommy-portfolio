"use client";
import { IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import HoverTranslate from "../HoverTranslate";
import { LANDING_ONLY } from "@/lib/launch";
import SoundToggle from "./SoundToggle";
import s from "./shell.module.css";
import a from "./HeaderAbout.module.css";

const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: "400", variable: "--font-plex-mono" });

export default function Header() {
  const pathname = usePathname();
  // On the home page the landing sheet carries its own corner bars; the studio header
  // waits until the sheet has scrolled away.
  const [overSheet, setOverSheet] = useState(false);
  useEffect(() => {
    const sheet = document.querySelector(".sheet");
    if (!sheet) return;
    const io = new IntersectionObserver(([e]) => setOverSheet(e.intersectionRatio > 0.15), {
      threshold: [0, 0.15, 0.3],
    });
    io.observe(sheet);
    return () => io.disconnect();
  }, [pathname]);
  // the live site is the landing sheet alone, and the sheet carries its own corner bars
  if (LANDING_ONLY) return null;

  const current = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`) ? ("page" as const) : undefined;

  if (pathname === "/about") {
    return (
      <header className={`${s.header} ${a.bar} ${mono.variable}`}>
        <Link href="/" className={a.home}>
          <HoverTranslate en="home" no="hjem" align="start" />
        </Link>
        <div className={a.here}>
          <span className={a.current} tabIndex={0} aria-current="page" aria-describedby="here-note">
            <HoverTranslate en="about" no="om meg" align="start" />
          </span>
          <span id="here-note" className={a.note}>
            <HoverTranslate en="you are here" no="du er her" align="start" />
          </span>
        </div>
        <button
          type="button"
          className={`${s.headerBtn} ${a.contact}`}
          onClick={() => window.dispatchEvent(new CustomEvent("studio:contact"))}
        >
          <HoverTranslate en="contact" no="kontakt" align="end" />
        </button>
      </header>
    );
  }

  // same corner bar as the landing sheet: mono, lowercase, two-line groups
  return (
    <header
      className={`${s.header} ${a.bar} ${mono.variable}`}
      data-hidden={overSheet && pathname === "/" ? "" : undefined}
    >
      <Link href="/" className={s.logo}>
        <span className={s.line}>
          <HoverTranslate en="a portfolio" no="en portefølje" align="start" />
        </span>
        <span className={s.line}>
          <HoverTranslate en="by tommy ngo nguyen" no="av tommy ngo nguyen" align="start" />
        </span>
      </Link>
      <div className={s.sound}>
        <SoundToggle className={`${s.headerBtn} ${a.plain}`} />
      </div>
      <nav className={s.nav} aria-label="Primary">
        <Link href="/about" aria-current={current("/about")}>
          <HoverTranslate en="about" no="om meg" align="end" />
        </Link>
        <button
          type="button"
          className={`${s.headerBtn} ${a.plain}`}
          onClick={() => window.dispatchEvent(new CustomEvent("studio:contact"))}
        >
          <HoverTranslate en="contact" no="kontakt" align="end" />
        </button>
      </nav>
    </header>
  );
}
