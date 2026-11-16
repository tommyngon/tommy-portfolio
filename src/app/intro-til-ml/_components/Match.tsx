"use client";

import { useEffect, useState } from "react";
import type { Flashcard, StudyData } from "../_data/types";
import s from "../intro.module.css";
import Md from "./Md";

type Card = Flashcard & { id: string };
type M = {
  chunks: Card[][];
  ri: number;
  right: Card[];
  done: string[];
  l: string | null;
  r: string | null;
  bad: boolean;
  pts: number;
  streak: number;
  max: number;
  wrongN: number;
  missed: Card[];
};

const KEY = "ml-match";
const SIZE = 5;
const shuffle = <T,>(a: T[]) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

const begin = (cards: Card[]): M => {
  const d = shuffle(cards);
  const chunks: Card[][] = [];
  for (let i = 0; i < d.length; i += SIZE) chunks.push(d.slice(i, i + SIZE));
  if (chunks.length > 1 && chunks[chunks.length - 1].length < 3) chunks[chunks.length - 2].push(...chunks.pop()!);
  return { chunks, ri: 0, right: shuffle(chunks[0]), done: [], l: null, r: null, bad: false, pts: 0, streak: 0, max: 0, wrongN: 0, missed: [] };
};

export default function Match({ data }: { data: StudyData }) {
  const [best, setBest] = useState(0);
  const [m, setM] = useState<M | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBest(+(localStorage.getItem(KEY) ?? 0) || 0);
    } catch {}
  }, []);

  const chapters = data.chapters.map((c, ci) => ({
    title: c.title,
    cards: c.cards.map((card, k) => ({ ...card, id: `${ci}-${k}` })),
  }));

  if (!m) {
    const row = (title: string, cards: Card[]) => (
      <button key={title} className={s.chap} onClick={() => setM(begin(cards))}>
        <span><b>{title}</b></span>
        <span className={s.meta}>{cards.length} par</span>
      </button>
    );
    return (
      <>
        <p className={s.meta}>
          Koble hvert spørsmål til riktig forklaring. Trykk ett spørsmål og én forklaring. Riktig par gir +10, feil gir −3 og nullstiller rekken. Beste rekke: {best}.
        </p>
        {row("Alle kapitler", chapters.flatMap((c) => c.cards))}
        {chapters.map((c) => row(c.title, c.cards))}
      </>
    );
  }

  const cur = m.chunks[m.ri];
  const finished = m.done.length === cur.length;
  const last = m.ri === m.chunks.length - 1;
  const quit = <button onClick={() => setM(null)}>Tilbake til kapitler</button>;

  const pick = (side: "l" | "r", id: string) => {
    if (m.bad || m.done.includes(id)) return;
    const n = side === "l" ? { ...m, l: m.l === id ? null : id } : { ...m, r: m.r === id ? null : id };
    if (!n.l || !n.r) return setM(n);
    if (n.l === n.r) {
      const streak = m.streak + 1;
      setM({ ...n, done: [...m.done, n.l], l: null, r: null, pts: m.pts + 10, streak, max: Math.max(m.max, streak) });
      if (streak > best) {
        setBest(streak);
        try {
          localStorage.setItem(KEY, String(streak));
        } catch {}
      }
      return;
    }
    const c = cur.find((x) => x.id === n.l)!;
    setM({ ...n, bad: true, pts: Math.max(0, m.pts - 3), streak: 0, wrongN: m.wrongN + 1, missed: m.missed.some((x) => x.id === c.id) ? m.missed : [...m.missed, c] });
    setTimeout(() => setM((p) => (p && p.bad ? { ...p, bad: false, l: null, r: null } : p)), 700);
  };

  const cls = (side: "l" | "r", id: string) =>
    m.done.includes(id) ? s.right : m[side] === id ? (m.bad ? s.wrong : s.sel) : "";

  return (
    <>
      <p className={s.meta}>
        runde {m.ri + 1}/{m.chunks.length} · poeng {m.pts} · rekke {m.streak} · beste rekke {Math.max(best, m.max)} · feil {m.wrongN}
      </p>
      <div className={s.cols}>
        <div>
          <p className={s.meta}>Spørsmål</p>
          {cur.map((c) => (
            <button key={c.id} className={`${s.opt} ${cls("l", c.id)}`} onClick={() => pick("l", c.id)}>
              <Md inline text={c.q} />
            </button>
          ))}
        </div>
        <div>
          <p className={s.meta}>Forklaring</p>
          {m.right.map((c) => (
            <button key={c.id} className={`${s.opt} ${cls("r", c.id)}`} onClick={() => pick("r", c.id)}>
              <Md inline text={c.a} />
            </button>
          ))}
        </div>
      </div>
      <div className={s.row}>
        {finished && !last && (
          <button className={s.primary} onClick={() => setM({ ...m, ri: m.ri + 1, right: shuffle(m.chunks[m.ri + 1]), done: [], l: null, r: null })}>
            Neste runde
          </button>
        )}
        {quit}
      </div>
      {finished && last && (
        <div className={s.card}>
          <p className={s.big}>Ferdig: {m.pts} poeng</p>
          <p>Feil forsøk: {m.wrongN}. Beste rekke: {m.max}.</p>
          {m.missed.length > 0 && (
            <button className={s.primary} onClick={() => setM(begin(m.missed))}>Øv på de jeg bommet på ({m.missed.length})</button>
          )}
        </div>
      )}
    </>
  );
}
