"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SoundToggle from "./SoundToggle";
import s from "./shell.module.css";

export default function Header() {
  const pathname = usePathname();
  const current = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`) ? ("page" as const) : undefined;

  return (
    <header className={`${s.header} ui-caps`}>
      <Link href="/" className={s.logo}>
        Tommy Ngo
        <br />
        Nguyen
      </Link>
      <div className={s.sound}>
        <SoundToggle className={`${s.headerBtn} ui-caps`} />
      </div>
      <nav className={s.nav} aria-label="Primary">
        <Link href="/work" aria-current={current("/work")}>
          Work
        </Link>
        <Link href="/about" aria-current={current("/about")}>
          About
        </Link>
        <button
          type="button"
          className={`${s.headerBtn} ui-caps`}
          onClick={() => window.dispatchEvent(new CustomEvent("studio:contact"))}
        >
          Contact
        </button>
      </nav>
    </header>
  );
}
