import type { Metadata } from "next";
import s from "./intro.module.css";

export const metadata: Metadata = {
  title: "Intro til ML",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function IntroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="nb" className={s.root}>
      {children}
    </div>
  );
}
