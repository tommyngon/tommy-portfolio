"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { COLUMN } from "@/lib/work";
import s from "./shell.module.css";

const FLAG = "studio:intro-seen";
const START_DELAY = 220; // blank paper
const FALL_MS = 960; // one card's fall
const STAGGER_MS = 65; // between cards (the cascade takes ~1.3s from the first sliver)
const FALL_SAMPLES = 40; // keyframes per card; the curve lives in these, the animation itself is linear
const HOLD_MS = 620; // column rests (or until a click / skip)
const HOLD_DRIFT = 1.02; // the hold is not a dead stop: the column keeps swelling a touch into the zoom
const ZOOM_MS = 880; // column scales up so card 1 lands on the target
const FADE_MS = 280; // overlay crossfade into the real page
const EASE_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";
const OMEGA = 7; // stiffness of the fall's critically damped curve (per unit of FALL_MS)
const SPRING_END = 1 - (1 + OMEGA) * Math.exp(-OMEGA);
// 0 to 1 from rest to rest, with no velocity jumps: sheets ease out of the emergence point and settle
const spring = (t: number) => (1 - (1 + OMEGA * t) * Math.exp(-OMEGA * t)) / SPRING_END;
const PERSPECTIVE = 900;
const COLUMN_TOP = 0.18; // of viewport height
const ORIGIN_Y = 0.19;
const GAP = 0.45 / 4.7; // gap relative to card width
const CARD_RATIO = 1.25; // 4:5

// per-card tumble at the point of emergence: [rotateX, rotateY, rotateZ]
const TUMBLE: [number, number, number][] = [
  [-55, 45, -22],
  [50, -55, 25],
  [-45, -40, 18],
  [58, 50, -25],
  [-50, 42, 20],
];

// sideways drift mid-fall, in card widths: the cards fan out and overlap before lining up
const SCATTER = [0.85, -0.7, 0.55, -0.9, 0.45];

type Target = "home" | "work" | "other";

function pickImages(target: Target): string[] {
  const col = COLUMN.map((c) => c.src);
  if (target === "home") {
    return [
      "/portrait/front.webp",
      ...col.slice(0, 4),
      "/portrait/profile-right-v2.webp",
    ].filter(Boolean);
  }
  return col.slice(0, 5);
}

function finish() {
  document.documentElement.dataset.intro = "done";
  window.dispatchEvent(new Event("studio:intro-done"));
}

// The intro itself. `force` ignores the once-per-visit flag (the home page always plays it).
function Intro({ force }: { force: boolean }) {
  const pathname = usePathname();
  const target: Target = pathname === "/" ? "home" : pathname === "/work" ? "work" : "other";
  const targetRef = useRef(target);
  const forceRef = useRef(force); // as mounted: leaving "/" must not restart this run
  const images = pickImages(target);
  const [off, setOff] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<(HTMLDivElement | null)[]>([]);
  const promptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(FLAG) === "1";
    } catch {}
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const html = document.documentElement;

    if ((seen && !forceRef.current) || reduced) {
      html.dataset.intro = "done";
      const t = window.setTimeout(() => {
        setOff(true);
        window.dispatchEvent(new Event("studio:intro-done"));
      }, 0);
      return () => window.clearTimeout(t);
    }

    // "running" tells the reveals (RevealLines, Scramble) to wait for studio:intro-done
    html.dataset.intro = "running";
    html.style.overflow = "hidden";

    const root = rootRef.current;
    const col = colRef.current;
    const cards = thumbRefs.current.filter(Boolean) as HTMLDivElement[];
    const anims: Animation[] = [];
    const timers: number[] = [];
    let cancelled = false;
    let ended = false;
    let go = false; // visitor clicked: skip the rest of the hold
    let wake: (() => void) | null = null;

    const sleep = (ms: number) =>
      new Promise<void>((res) => {
        timers.push(window.setTimeout(res, ms));
      });
    const run = (el: HTMLElement, frames: Keyframe[], duration: number, easing: string, delay = 0) => {
      const a = el.animate(frames, { duration, easing, delay, fill: "both" });
      anims.push(a);
      return a.finished.catch(() => undefined);
    };

    const end = () => {
      if (ended) return;
      ended = true;
      html.style.overflow = "";
      try {
        sessionStorage.setItem(FLAG, "1");
      } catch {}
      setOff(true);
      finish();
    };

    const crossfade = async (ms: number) => {
      if (!root) return end();
      finish(); // header + text start revealing under the fade
      html.style.overflow = "";
      await run(root, [{ opacity: 1 }, { opacity: 0 }], ms, "ease-out");
      end();
    };

    const hidePrompt = () => {
      if (promptRef.current) promptRef.current.style.display = "none";
    };

    const onSkip = () => {
      if (ended || cancelled) return;
      cancelled = true;
      timers.forEach(clearTimeout);
      wake?.();
      hidePrompt();
      if (root) {
        root.style.pointerEvents = "none";
        void crossfade(300);
      } else end();
    };
    const onSound = () => {
      go = true;
      hidePrompt();
      wake?.();
    };
    window.addEventListener("studio:skip-intro", onSkip);
    window.addEventListener("studio:sound", onSound);

    // Every image is decoded before the first card moves, including ones already in the
    // cache, so no card can stall a frame on its first paint. The wait is capped so a slow
    // connection still gets its intro.
    const loaded = async () => {
      const imgs = cards.map((c) => c.querySelector("img")).filter(Boolean) as HTMLImageElement[];
      const all = Promise.all(imgs.map((im) => im.decode().catch(() => undefined)));
      await Promise.race([all, sleep(2500)]);
    };

    const play = async () => {
      if (!root || !col || cards.length === 0) return end();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const W = cards[0].offsetWidth;
      const H = W * CARD_RATIO;
      const gap = W * GAP;
      const x0 = vw / 2 - W / 2;
      const y0 = vh * COLUMN_TOP;
      const ox = vw / 2;
      const oy = vh * ORIGIN_Y;

      // slots in the column; transforms animate from the emergence point
      cards.forEach((el, i) => {
        el.style.left = `${x0}px`;
        el.style.top = `${y0 + i * (H + gap)}px`;
        el.style.zIndex = String(cards.length - i);
        el.style.willChange = "transform, opacity"; // layers are ready before the first frame moves
      });
      col.style.willChange = "transform";
      col.style.transformOrigin = "0 0";

      await loaded();
      if (cancelled) return;
      await sleep(START_DELAY);
      if (cancelled) return;

      const tf = (dx: number, dy: number, r: number[], sc: number) =>
        `translate(${dx}px, ${dy}px) perspective(${PERSPECTIVE}px) rotateX(${r[0]}deg) rotateY(${r[1]}deg) rotateZ(${r[2]}deg) scale(${sc})`;
      // One continuous curve per card, sampled into keyframes (no segment corners): the
      // card swings out, drifts sideways and lands flat in its slot.
      const falls = cards.map((el, i) => {
        const dx = ox - (x0 + W / 2);
        const dy = oy - (y0 + i * (H + gap) + H / 2);
        const r = TUMBLE[i % TUMBLE.length];
        const sx = SCATTER[i % SCATTER.length] * W;
        const frames: Keyframe[] = [];
        for (let k = 0; k <= FALL_SAMPLES; k++) {
          const t = k / FALL_SAMPLES;
          const e = spring(t);
          frames.push({
            transform: tf(
              dx * (1 - e) + sx * Math.sin(Math.PI * e),
              dy * (1 - e),
              [r[0] * (1 - e), r[1] * (1 - e), r[2] * (1 - e)],
              0.05 + 0.95 * e,
            ),
            opacity: Math.min(1, t / 0.07),
            offset: t,
          });
        }
        return run(el, frames, FALL_MS, "linear", i * STAGGER_MS);
      });
      await Promise.all(falls);
      if (cancelled) return;

      // hold, until the timer runs out or the visitor clicks
      if (!go) {
        const midX = x0 + W / 2;
        const midY = vh / 2;
        anims.push(
          col.animate(
            [
              { transform: "translate(0px, 0px) scale(1)" },
              { transform: `translate(${midX * (1 - HOLD_DRIFT)}px, ${midY * (1 - HOLD_DRIFT)}px) scale(${HOLD_DRIFT})` },
            ],
            { duration: HOLD_MS, easing: "linear", fill: "forwards" },
          ),
        );
        await new Promise<void>((res) => {
          wake = res;
          timers.push(window.setTimeout(res, HOLD_MS));
        });
      }
      wake = null;
      hidePrompt();
      if (cancelled) return;

      // zoom: card 1 travels from its slot to exactly the target rect
      let r: DOMRect | null = null;
      const sel =
        targetRef.current === "home"
          ? ".sheet-portrait .portrait"
          : targetRef.current === "work"
            ? "[data-seam]"
            : null;
      const el = sel ? document.querySelector<HTMLElement>(sel) : null;
      if (el) {
        const b = el.getBoundingClientRect();
        if (b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < vh) r = b;
      }
      const tw = r ? r.width : W * 1.6;
      const sc = tw / W;
      const tl = r ? r.left : vw / 2 - tw / 2;
      const tt = r ? r.top : vh / 2 - (H * sc) / 2;
      const tx = tl - sc * x0;
      const ty = tt - sc * y0;
      // the zoom picks up exactly where the hold's drift has got to
      const from = new DOMMatrixReadOnly(getComputedStyle(col).transform);
      anims.filter((a) => a.effect && (a.effect as KeyframeEffect).target === col).forEach((a) => a.cancel());
      const zoom = run(
        col,
        [
          { transform: `translate(${from.e}px, ${from.f}px) scale(${from.a})` },
          { transform: `translate(${tx}px, ${ty}px) scale(${sc})` },
        ],
        ZOOM_MS,
        EASE_IN_OUT,
      );
      // paper bend on card 1 in the last stretch; also stretches it to the target's aspect
      const img = cards[0].querySelector<HTMLElement>("img");
      if (img) {
        const sy = r ? r.height / (tw * CARD_RATIO) : 1;
        const p = `perspective(700px)`;
        run(
          img,
          [
            { transform: `${p} rotateX(0deg) scaleY(1)`, offset: 0 },
            { transform: `${p} rotateX(0deg) scaleY(1)`, offset: 0.65 },
            { transform: `${p} rotateX(9deg) scaleX(0.985) scaleY(${1 + (sy - 1) * 0.7})`, offset: 0.86 },
            { transform: `${p} rotateX(0deg) scaleX(1) scaleY(${sy})`, offset: 1 },
          ],
          ZOOM_MS,
          "linear",
        );
        img.style.transformOrigin = "50% 0%";
      }
      // When the target is small (the landing portrait) the column can't push the other
      // cards off-screen, so they dissolve on the way and card 1 arrives alone.
      if (sc < 4) {
        cards.slice(1).forEach((c) => {
          // the offset-1 frame matters: without it the card snaps back to its fall's end state (opaque) as card 1 lands
          void run(c, [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0, offset: 0.85 }, { opacity: 0, offset: 1 }], ZOOM_MS, "linear");
        });
      }
      await zoom;
      if (cancelled) return;
      await crossfade(FADE_MS);
    };
    void play();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      anims.forEach((a) => a.cancel());
      window.removeEventListener("studio:skip-intro", onSkip);
      window.removeEventListener("studio:sound", onSound);
      html.style.overflow = "";
      // leaving the studio (e.g. back to the landing) lets the next entry replay the intro
      try {
        sessionStorage.removeItem(FLAG);
      } catch {}
    };
  }, []);

  if (off) return null;

  return (
    <div
      ref={rootRef}
      className={s.preloader}
      role="presentation"
      onClick={() => window.dispatchEvent(new CustomEvent("studio:sound", { detail: true }))}
    >
      <button
        type="button"
        className={`${s.skipIntro} ui-caps`}
        onClick={(e) => {
          e.stopPropagation();
          window.dispatchEvent(new Event("studio:skip-intro"));
        }}
      >
        Skip intro
      </button>
      <div className={s.thumbs} aria-hidden="true">
        <div ref={colRef} className={s.thumbCol}>
          {images.map((src, i) => (
            <div
              key={src}
              ref={(el) => {
                thumbRefs.current[i] = el;
              }}
              className={s.thumb}
            >
              {i === 0 ? (
                // eslint-disable-next-line @next/next/no-img-element -- the card that lands on the real sheet: the same file, not a resized copy
                <img src={src} alt="" className={s.thumbImg} draggable={false} decoding="async" />
              ) : (
                // the others are small and short-lived: a small variant decodes 10x faster
                <Image src={src} alt="" width={384} height={480} sizes="192px" loading="eager" className={s.thumbImg} draggable={false} />
              )}
            </div>
          ))}
        </div>
      </div>
      <button
        ref={promptRef}
        type="button"
        className={`${s.soundPrompt} ui-caps`}
        onClick={() => window.dispatchEvent(new CustomEvent("studio:sound", { detail: true }))}
      >
        Click to enable sound
      </button>
    </div>
  );
}

// Every arrival at the very start (first load, reload, a link or back button to "/") replays
// the intro: a new key mounts a fresh Intro. Other pages play it once per visit.
export default function Preloader() {
  const pathname = usePathname();
  const [prevPath, setPrevPath] = useState(pathname);
  const [runs, setRuns] = useState(0);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    if (pathname === "/") setRuns((n) => n + 1);
  }
  // the browser's back/forward cache restores the page frozen, without a route change
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted && window.location.pathname === "/") setRuns((n) => n + 1);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  return <Intro key={runs} force={pathname === "/"} />;
}
