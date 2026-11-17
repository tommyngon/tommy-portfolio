"use client";

import { useEffect, useState } from "react";
import type { Flashcard, QuizCategory, QuizQuestion, StudyData } from "../_data/types";
import s from "../intro.module.css";
import Match from "./Match";
import Md from "./Md";

type Card = Flashcard & { id: string };
type Store = { known: string[]; best: number };
type Round = { deck: Card[]; i: number; show: boolean; got: number; pts: number; streak: number; max: number; missed: Card[] };

const KEY = "ml-flash";
const shuffle = <T,>(a: T[]) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

function Cards({ data }: { data: StudyData }) {
  const [store, setStore] = useState<Store>({ known: [], best: 0 });
  const [round, setRound] = useState<Round | null>(null);

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v && Array.isArray(v.known)) setStore({ known: v.known, best: +v.best || 0 });
    } catch {}
  }, []);

  const save = (n: Store) => {
    setStore(n);
    try {
      localStorage.setItem(KEY, JSON.stringify(n));
    } catch {}
  };
  const chapters = data.chapters.map((c, ci) => ({
    title: c.title,
    cards: c.cards.map((card, k) => ({ ...card, id: `${ci}-${k}` })),
  }));
  const start = (cards: Card[]) =>
    setRound({ deck: shuffle(cards), i: 0, show: false, got: 0, pts: 0, streak: 0, max: 0, missed: [] });
  const answer = (ok: boolean, r: Round) => {
    const c = r.deck[r.i];
    const streak = ok ? r.streak + 1 : 0;
    save({
      known: ok ? [...new Set([...store.known, c.id])] : store.known.filter((x) => x !== c.id),
      best: Math.max(store.best, streak),
    });
    setRound({
      ...r,
      i: r.i + 1,
      show: false,
      got: r.got + (ok ? 1 : 0),
      pts: r.pts + (ok ? 10 : 0),
      streak,
      max: Math.max(r.max, streak),
      missed: ok ? r.missed : [...r.missed, c],
    });
  };

  if (round) {
    const r = round;
    const back = <button onClick={() => setRound(null)}>Tilbake til kapitler</button>;
    if (r.i >= r.deck.length)
      return (
        <div className={s.card}>
          <p className={s.big}>{r.got} av {r.deck.length} kunne</p>
          <p>Poeng: {r.pts}. Beste rekke: {r.max}.</p>
          <div className={s.row}>
            {r.missed.length > 0 && (
              <button className={s.primary} onClick={() => start(r.missed)}>Gjenta de jeg ikke kunne ({r.missed.length})</button>
            )}
            {back}
          </div>
        </div>
      );
    const c = r.deck[r.i];
    return (
      <>
        <p className={s.meta}>
          kort {r.i + 1}/{r.deck.length} · poeng {r.pts} · rekke {r.streak} · beste rekke {Math.max(store.best, r.max)}
        </p>
        <div key={c.id} className={s.card} onClick={() => setRound({ ...r, show: true })}>
          <Md text={c.q} />
          <div className={`${s.reveal} ${r.show ? s.shown : ""}`} aria-hidden={!r.show}>
            <Md text={c.a} />
          </div>
        </div>
        <div className={s.row}>
          {r.show ? (
            <>
              <button className={s.primary} onClick={() => answer(true, r)}>Kunne</button>
              <button onClick={() => answer(false, r)}>Kunne ikke</button>
            </>
          ) : (
            <button className={s.primary} onClick={() => setRound({ ...r, show: true })}>Vis svar</button>
          )}
          {back}
        </div>
      </>
    );
  }

  const all = chapters.flatMap((c) => c.cards);
  const row = (title: string, cards: Card[]) => {
    const n = cards.filter((c) => store.known.includes(c.id)).length;
    return (
      <button key={title} className={s.chap} disabled={!cards.length} onClick={() => start(cards)}>
        <span><b>{title}</b></span>
        <span className={s.meta}>kunne {n}/{cards.length}</span>
        <span className={s.bar}><i style={{ width: `${cards.length ? (100 * n) / cards.length : 0}%` }} /></span>
      </button>
    );
  };
  return (
    <>
      <p className={s.meta}>Velg et kapittel. Beste rekke: {store.best}.</p>
      {row("Alle kapitler", all)}
      {chapters.map((c) => row(c.title, c.cards))}
      <div className={s.row}>
        <button onClick={() => save({ known: [], best: 0 })}>Nullstill fremgang</button>
      </div>
    </>
  );
}

type Z = { origin: { src: QuizQuestion[]; n?: number }; list: QuizQuestion[]; i: number; pick: string | null; score: number; streak: number; wrong: QuizQuestion[] };
const deal = (src: QuizQuestion[], n?: number): Z => ({ origin: { src, n }, list: shuffle(src).slice(0, n), i: 0, pick: null, score: 0, streak: 0, wrong: [] });

function Quiz({ cats }: { cats: QuizCategory[] }) {
  const [z, setZ] = useState<Z | null>(null);

  if (!z) {
    const all = cats.flatMap((c) => c.quiz);
    const row = (title: string, src: QuizQuestion[], n?: number) => (
      <button key={title} className={s.chap} onClick={() => setZ(deal(src, n))}>
        <span><b>{title}</b></span>
        <span className={s.meta}>{n ?? src.length} spørsmål</span>
      </button>
    );
    return (
      <>
        <p className={s.meta}>Velg en kategori. Spørsmålene blandes hver gang. Fasit og forklaring vises med en gang du har svart.</p>
        {row(`Tilfeldig utvalg fra alle (${all.length} spørsmål totalt)`, all, 30)}
        {cats.map((c) => row(c.title, c.quiz))}
      </>
    );
  }

  const q = z.list[z.i];
  if (!q)
    return (
      <div className={s.card}>
        <p className={s.big}>{z.score} av {z.list.length}</p>
        <div className={s.row}>
          {z.wrong.length > 0 && (
            <button className={s.primary} onClick={() => setZ({ ...deal(z.wrong), origin: z.origin })}>Ta de jeg bommet på igjen ({z.wrong.length})</button>
          )}
          <button onClick={() => setZ(deal(z.origin.src, z.origin.n))}>Samme kategori på nytt</button>
          <button onClick={() => setZ(null)}>Velg kategori</button>
        </div>
      </div>
    );

  const choose = (k: string) => {
    if (z.pick) return;
    const ok = k === q.answer;
    setZ({ ...z, pick: k, score: z.score + (ok ? 1 : 0), streak: ok ? z.streak + 1 : 0, wrong: ok ? z.wrong : [...z.wrong, q] });
  };
  return (
    <>
      <p className={s.meta}>
        Spørsmål {z.i + 1} av {z.list.length} ({q.tag}) · riktige {z.score} · rekke {z.streak}
      </p>
      <div className={s.card}>
        <Md text={q.stem} />
        {q.options.map((o) => {
          const cls = !z.pick ? "" : o.key === q.answer ? s.right : o.key === z.pick ? s.wrong : "";
          return (
            <button key={o.key} className={`${s.opt} ${cls}`} onClick={() => choose(o.key)}>
              <b>{o.key}</b>
              <Md inline text={o.text} />
            </button>
          );
        })}
        {z.pick && (
          <div className={`${s.reveal} ${s.shown}`}>
            <p><b>{z.pick === q.answer ? "Riktig!" : `Feil – riktig svar er ${q.answer}`}</b></p>
            <Md text={q.explanation} />
          </div>
        )}
      </div>
      <div className={s.row}>
        {z.pick && (
          <button className={s.primary} onClick={() => setZ({ ...z, i: z.i + 1, pick: null })}>
            {z.i + 1 === z.list.length ? "Se resultat" : "Neste"}
          </button>
        )}
        <button onClick={() => setZ(null)}>Avbryt</button>
      </div>
    </>
  );
}

export default function Flashcards({ data, extra }: { data: StudyData; extra: QuizCategory[] }) {
  const [tab, setTab] = useState<"kort" | "quiz" | "koble">("kort");
  return (
    <>
      <div className={s.row}>
        <button className={tab === "kort" ? s.primary : ""} onClick={() => setTab("kort")}>Flashcards</button>
        <button className={tab === "quiz" ? s.primary : ""} onClick={() => setTab("quiz")}>Hurtigquiz</button>
        <button className={tab === "koble" ? s.primary : ""} onClick={() => setTab("koble")}>Koble sammen</button>
      </div>
      <div hidden={tab !== "kort"}><Cards data={data} /></div>
      <div hidden={tab !== "quiz"}><Quiz cats={[{ title: "Original hurtigquiz", quiz: data.quiz }, ...extra]} /></div>
      <div hidden={tab !== "koble"}><Match data={data} /></div>
    </>
  );
}
