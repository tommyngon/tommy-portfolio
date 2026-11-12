import Link from "next/link";
import s from "./intro.module.css";

export default function Page() {
  return (
    <>
      <h1>Intro til ML</h1>
      <nav className={s.menu}>
        <Link className={s.card} href="/intro-til-ml/flashcards">Flashcards og hurtigquiz</Link>
        <Link className={s.card} href="/intro-til-ml/eksamen/2024">Eksamen 2024</Link>
        <Link className={s.card} href="/intro-til-ml/eksamen/2025">Eksamen 2025</Link>
      </nav>
    </>
  );
}
