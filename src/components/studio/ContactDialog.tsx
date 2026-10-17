"use client";
import { useEffect, useRef } from "react";
import { CONTACT, SOCIALS } from "@/lib/site";
import { playSound } from "./sound";
import s from "./shell.module.css";

// Open from anywhere with window.dispatchEvent(new CustomEvent("studio:contact")).
export default function ContactDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    const html = document.documentElement;
    const onOpen = () => {
      if (dlg.open) return;
      trigger.current = document.activeElement as HTMLElement | null;
      dlg.showModal();
      html.style.overflow = "hidden";
      window.dispatchEvent(new CustomEvent("studio:scroll-lock", { detail: true }));
      playSound("open");
    };
    const onClose = () => {
      html.style.overflow = "";
      window.dispatchEvent(new CustomEvent("studio:scroll-lock", { detail: false }));
      trigger.current?.focus?.();
    };
    window.addEventListener("studio:contact", onOpen);
    dlg.addEventListener("close", onClose);
    return () => {
      window.removeEventListener("studio:contact", onOpen);
      dlg.removeEventListener("close", onClose);
      html.style.overflow = "";
    };
  }, []);

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
    <dialog
      ref={ref}
      className={s.dialog}
      aria-labelledby="contact-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close(); // backdrop click
      }}
    >
      <div className={s.panel}>
        <div className={s.panelTop}>
          <h2 id="contact-title" className="title-caps">
            Contact
          </h2>
          <button type="button" className={`${s.close} ui-caps`} onClick={() => ref.current?.close()}>
            Close
          </button>
        </div>
        <p className={s.links}>
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          {SOCIALS.map((so) => (
            <a key={so.href} href={so.href} target="_blank" rel="noreferrer">
              {so.label}
            </a>
          ))}
        </p>
        <form className={s.form} onSubmit={onSubmit}>
          <label>
            <span className="ui-caps">Name</span>
            <input name="name" type="text" required autoComplete="name" />
          </label>
          <label>
            <span className="ui-caps">Email</span>
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            <span className="ui-caps">Message</span>
            <textarea name="message" rows={5} required />
          </label>
          <button type="submit" className={`${s.send} ui-caps`}>
            Send
          </button>
        </form>
      </div>
    </dialog>
  );
}
