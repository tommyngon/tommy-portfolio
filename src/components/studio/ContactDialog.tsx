"use client";
import { useCallback, useEffect, useRef } from "react";
import { CONTACT, SOCIALS } from "@/lib/site";
import HoverText from "../HoverText";
import { playSound } from "./sound";
import s from "./shell.module.css";

// Open from anywhere with window.dispatchEvent(new CustomEvent("studio:contact")).
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

// Paper sheet clip: a bulged (convex) leading top edge that flattens as the sheet lands.
// Both paths share the same commands so they interpolate.
const sheetPath = (w: number, h: number, bulge: number) =>
  `path("M0 ${bulge} Q ${w / 2} ${-bulge} ${w} ${bulge} L ${w} ${h} L 0 ${h} Z")`;

export default function ContactDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const closing = useRef(false);

  const requestClose = useCallback(() => {
    const dlg = ref.current;
    const veil = veilRef.current;
    const panel = panelRef.current;
    if (!dlg || !dlg.open || closing.current) return;
    closing.current = true;
    dlg.dataset.state = "closing";
    const done = () => {
      closing.current = false;
      dlg.close();
    };
    if (!veil || !panel) return done();
    let finished: Promise<unknown>;
    if (reduced()) {
      const fade = [{ opacity: 1 }, { opacity: 0 }];
      veil.animate(fade, { duration: 150, fill: "forwards" });
      finished = panel.animate(fade, { duration: 150, fill: "forwards" }).finished;
    } else {
      const w = panel.offsetWidth;
      const h = panel.offsetHeight;
      const bulge = Math.min(90, h * 0.14);
      veil.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 450,
        delay: 100,
        easing: "ease-in",
        fill: "forwards",
      });
      finished = panel.animate(
        [
          { transform: "translateY(0)", clipPath: sheetPath(w, h, 0) },
          { transform: "translateY(100%)", clipPath: sheetPath(w, h, bulge) },
        ],
        { duration: 550, delay: 100, easing: "cubic-bezier(0.6, 0, 0.8, 0.4)", fill: "forwards" },
      ).finished;
    }
    finished.then(done, done);
  }, []);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    const html = document.documentElement;
    const unlock = () => {
      html.style.overflow = "";
      html.style.scrollbarGutter = "";
    };
    const onOpen = () => {
      if (dlg.open || closing.current) return;
      trigger.current = document.activeElement as HTMLElement | null;
      // drop leftovers (fill: forwards) from a previous close so they can't re-apply after this open
      dlg.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      dlg.dataset.state = "open";
      dlg.showModal();
      // keep the scrollbar gutter so the page does not shift sideways while locked
      html.style.scrollbarGutter = "stable";
      html.style.overflow = "hidden";
      window.dispatchEvent(new CustomEvent("studio:scroll-lock", { detail: true }));
      playSound("open");
      const panel = panelRef.current;
      const veil = veilRef.current;
      if (reduced()) {
        const fade = [{ opacity: 0 }, { opacity: 1 }];
        veil?.animate(fade, { duration: 150 });
        panel?.animate(fade, { duration: 150 });
        return;
      }
      veil?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: "ease-out" });
      if (panel) {
        const w = panel.offsetWidth;
        const h = panel.offsetHeight;
        const bulge = Math.min(90, h * 0.14);
        panel.animate(
          [
            { transform: "translateY(100%)", clipPath: sheetPath(w, h, bulge), offset: 0 },
            { transform: "translateY(0)", clipPath: sheetPath(w, h, 0), offset: 1 },
          ],
          { duration: 900, easing: EASE },
        );
      }
    };
    const onClose = () => {
      dlg.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      delete dlg.dataset.state;
      unlock();
      window.dispatchEvent(new CustomEvent("studio:scroll-lock", { detail: false }));
      trigger.current?.focus?.({ preventScroll: true });
    };
    const onCancel = (e: Event) => {
      e.preventDefault();
      requestClose();
    };
    window.addEventListener("studio:contact", onOpen);
    dlg.addEventListener("close", onClose);
    dlg.addEventListener("cancel", onCancel);
    return () => {
      window.removeEventListener("studio:contact", onOpen);
      dlg.removeEventListener("close", onClose);
      dlg.removeEventListener("cancel", onCancel);
      unlock();
    };
  }, [requestClose]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const email = String(f.get("email") ?? "").trim();
    const message = String(f.get("message") ?? "").trim();
    const body = `${message}\n\n${name}${email ? ` (${email})` : ""}`;
    window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(
      `Hello from ${name}`,
    )}&body=${encodeURIComponent(body)}`;
  };

  return (
    <dialog ref={ref} className={s.dialog} aria-labelledby="contact-title">
      <div ref={veilRef} className={s.dialogVeil} onClick={requestClose} />
      <div ref={panelRef} className={s.panel}>
        <p className={`${s.row} ${s.linksRow} ${s.links} ui-caps`} style={{ "--i": 0 } as React.CSSProperties}>
          <a href={`mailto:${CONTACT.email}`}><HoverText en="Mail" no="E-post" /></a>
          {SOCIALS.map((so) => (
            <a key={so.href} href={so.href} target="_blank" rel="noopener noreferrer">
              {so.label}
            </a>
          ))}
        </p>
        <div className={`${s.row} ${s.panelTop}`} style={{ "--i": 1 } as React.CSSProperties}>
          <h2 id="contact-title" className="title-caps">
            <HoverText en="Contact me" no="Ta kontakt" />
          </h2>
          <button type="button" className={`${s.close} ui-caps`} onClick={requestClose}>
            <HoverText en="Close" no="Lukk" />
          </button>
        </div>
        <form className={s.form} onSubmit={onSubmit}>
          <div className={`${s.row} ${s.field}`} style={{ "--i": 2 } as React.CSSProperties}>
            <input name="name" type="text" placeholder="Name" aria-label="Name" required autoComplete="name" autoFocus />
          </div>
          <div className={`${s.row} ${s.field}`} style={{ "--i": 3 } as React.CSSProperties}>
            <input name="email" type="email" placeholder="Email" aria-label="Email" required autoComplete="email" />
          </div>
          <div className={`${s.row} ${s.field} ${s.fieldArea}`} style={{ "--i": 4 } as React.CSSProperties}>
            <textarea name="message" placeholder="Message" aria-label="Message" required />
          </div>
          <button type="submit" className={`${s.row} ${s.send} ui-caps`} style={{ "--i": 5 } as React.CSSProperties}>
            <HoverText en="Send" no="Send" />
          </button>
        </form>
      </div>
    </dialog>
  );
}
