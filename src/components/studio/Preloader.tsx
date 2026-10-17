"use client";
import { useEffect, useState } from "react";
import { COLUMN } from "@/lib/work";
import s from "./shell.module.css";

const FLAG = "studio:intro-seen";
const THUMBS = [0, 3, 6, 1, 4].map((i) => COLUMN[i]).filter(Boolean);
const FADE_AT = 2300; // overlay starts fading
const END_AT = 3000; // overlay gone, intro done

function finish() {
  document.documentElement.dataset.intro = "done";
  window.dispatchEvent(new Event("studio:intro-done"));
}

export default function Preloader() {
  const [phase, setPhase] = useState<"on" | "fading" | "off">("on");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(FLAG) === "1";
    } catch {}
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const html = document.documentElement;

    if (seen || reduced) {
      html.dataset.intro = "done";
      const t = window.setTimeout(() => {
        setPhase("off");
        window.dispatchEvent(new Event("studio:intro-done"));
      }, 0);
      return () => window.clearTimeout(t);
    }

    // "running" tells the reveals (RevealLines, Scramble) to wait for studio:intro-done
    html.dataset.intro = "running";
    html.style.overflow = "hidden";
    const done = () => {
      html.style.overflow = "";
      try {
        sessionStorage.setItem(FLAG, "1");
      } catch {}
      setPhase("off");
      finish();
    };
    const t1 = window.setTimeout(() => setPhase("fading"), FADE_AT);
    const t2 = window.setTimeout(done, END_AT);
    const onSkip = () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      setPhase("fading");
      window.setTimeout(done, 400);
    };
    window.addEventListener("studio:skip-intro", onSkip);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("studio:skip-intro", onSkip);
      html.style.overflow = "";
      // leaving the studio (e.g. back to the landing) lets the next entry replay the intro
      try {
        sessionStorage.removeItem(FLAG);
      } catch {}
    };
  }, []);

  if (phase === "off") return null;

  return (
    <div className={s.preloader} data-fading={phase === "fading" || undefined} role="presentation">
      <button
        type="button"
        className={`${s.skipIntro} ui-caps`}
        onClick={() => window.dispatchEvent(new Event("studio:skip-intro"))}
      >
        Skip intro
      </button>
      <div className={s.thumbs} aria-hidden="true">
        {THUMBS.map((t, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={t.src}
            src={t.src}
            alt=""
            className={s.thumb}
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
      <button
        type="button"
        className={`${s.soundPrompt} ui-caps`}
        onClick={() => window.dispatchEvent(new CustomEvent("studio:sound", { detail: true }))}
      >
        Click to enable sound
      </button>
    </div>
  );
}
