"use client";

import { useEffect, useState } from "react";
import type { Exam as ExamData, ExamQuestion } from "../_data/types";
import s from "../intro.module.css";
import Md from "./Md";

type Saved = { answers: Record<string, string[]>; idx: number; submitted: boolean };
type Status = "right" | "wrong" | "blank";

const EMPTY: Saved = { answers: {}, idx: 0, submitted: false };
const nb = (n: number) => n.toLocaleString("nb-NO", { maximumFractionDigits: 2 });
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export default function Exam({ exam }: { exam: ExamData }) {
  const key = `ml-exam-${exam.year}`;
  const qs = exam.questions;
  const [st, setSt] = useState<Saved>(EMPTY);
  const [started, setStarted] = useState(false);
  const [onlyBad, setOnlyBad] = useState(false);
  const { answers, submitted } = st;
  const idx = Math.min(st.idx, qs.length - 1);

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v && typeof v.answers === "object") setSt({ answers: v.answers, idx: +v.idx || 0, submitted: !!v.submitted });
    } catch {}
  }, [key]);

  const save = (n: Saved) => {
    setSt(n);
    try {
      localStorage.setItem(key, JSON.stringify(n));
    } catch {}
  };
  const label = (q: ExamQuestion) => (exam.year === "2024" ? `Oppgave ${q.id}` : `${q.group} · Spørsmål ${q.id}`);
  const got = (q: ExamQuestion) => answers[q.id] ?? [];
  const status = (q: ExamQuestion): Status => {
    const a = got(q);
    if (!a.length) return "blank";
    const ok = same(a, q.correct) || (exam.scoring === "nm2025" && a.length === 1 && !!q.alsoAccepted?.includes(a[0]));
    return ok ? "right" : "wrong";
  };
  const pick = (q: ExamQuestion, k: string) => {
    const cur = got(q);
    const next = q.multi ? (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k].sort()) : [k];
    save({ ...st, answers: { ...answers, [q.id]: next } });
  };
  const clear = (q: ExamQuestion) => {
    const rest = { ...answers };
    delete rest[q.id];
    save({ ...st, answers: rest });
  };
  const submit = () => {
    const blank = qs.filter((q) => !got(q).length).length;
    if (window.confirm(`Du har ${blank} ubesvarte. Vil du levere?`)) save({ ...st, submitted: true });
  };
  const restart = () => {
    setSt(EMPTY);
    setStarted(false);
    try {
      localStorage.removeItem(key);
    } catch {}
  };
  const keys = (q: ExamQuestion, ks: string[]) =>
    ks.length ? (
      ks.map((k) => (
        <span key={k} className={s.blk}>
          <b>{k}</b> <Md inline text={q.options.find((o) => o.key === k)?.text ?? ""} />
        </span>
      ))
    ) : (
      <span className={s.blk}>(ingen svar)</span>
    );

  if (submitted) {
    const rows = qs.map((q) => ({ q, status: status(q) }));
    const count = (list: typeof rows, t: Status) => list.filter((r) => r.status === t).length;
    const groups = [...new Set(qs.map((q) => q.group))].map((g) => {
      const list = rows.filter((r) => r.q.group === g);
      const [right, wrong, blank] = (["right", "wrong", "blank"] as const).map((t) => count(list, t));
      return { g, right, wrong, blank, pts: Math.min(10, Math.max(0, right * 2.5 - wrong * 0.83)) };
    });
    const shown = onlyBad ? rows.filter((r) => r.status !== "right") : rows;
    return (
      <>
        <h1>{exam.title}: resultat</h1>
        {exam.scoring === "nm2025" ? (
          <div className={s.card}>
            <p className={s.big}>{nb(groups.reduce((sum, g) => sum + g.pts, 0))} av 100</p>
            <p className={s.meta}>+2,5 for riktig, −0,83 for feil, 0 for blank. Hver del gir 0 til 10 poeng.</p>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr><th>Part</th><th>Riktige</th><th>Feil</th><th>Blanke</th><th>Poeng</th></tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.g}>
                      <td>{g.g}</td><td>{g.right}</td><td>{g.wrong}</td><td>{g.blank}</td><td>{nb(g.pts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className={s.card}>
            <p className={s.big}>{count(rows, "right")} av {qs.length} riktige</p>
            <p>{count(rows, "blank")} ubesvarte</p>
            <p className={s.meta}>Poengreglene for 2024 er ikke oppgitt, så her telles bare riktig/feil.</p>
          </div>
        )}
        <div className={s.row}>
          <label>
            <input type="checkbox" checked={onlyBad} onChange={(e) => setOnlyBad(e.target.checked)} /> Vis bare feil og ubesvarte
          </label>
          <button onClick={restart}>Ta eksamen på nytt</button>
        </div>
        {shown.map(({ q, status: t }) => (
          <div key={q.id} className={s.card}>
            <p>
              <b>{label(q)}</b>{" "}
              <span className={`${s.pill} ${t === "right" ? s.right : t === "wrong" ? s.wrong : ""}`}>
                {t === "right" ? "Riktig" : t === "wrong" ? "Feil" : "Ubesvart"}
              </span>
            </p>
            <p>Ditt svar: {keys(q, got(q))}</p>
            <p>Riktig svar: {keys(q, q.correct)}</p>
            {q.alsoAccepted && <p>Også godkjent ved sensur: {keys(q, q.alsoAccepted)}</p>}
            <details>
              <summary>Vis oppgaveteksten</summary>
              <Md text={q.stem} />
            </details>
            <Md text={q.explanation} />
          </div>
        ))}
      </>
    );
  }

  if (!started) {
    const saved = Object.keys(answers).length > 0;
    return (
      <>
        <h1>{exam.title}</h1>
        <Md text={exam.info} />
        <Md text={exam.fasitNote} />
        <p>{qs.length} spørsmål.</p>
        <button className={s.primary} onClick={() => setStarted(true)}>{saved ? "Fortsett" : "Start"}</button>
      </>
    );
  }

  const q = qs[idx];
  const go = (n: number) => save({ ...st, idx: n });
  return (
    <>
      <p className={s.meta}>Spørsmål {idx + 1} av {qs.length}</p>
      <div className={s.card}>
        <h2>{label(q)}</h2>
        {exam.year === "2024" && <p><b>{q.group}</b></p>}
        <p className={s.meta}>{q.multi ? "Velg ett eller flere alternativer" : "Velg ett alternativ"}</p>
        <Md text={q.stem} />
        {q.options.map((o) => {
          const on = got(q).includes(o.key);
          return (
            <label key={o.key} className={`${s.opt} ${on ? s.sel : ""}`}>
              <input type={q.multi ? "checkbox" : "radio"} name={q.id} checked={on} onChange={() => pick(q, o.key)} />
              <b>{o.key}</b>
              <Md inline text={o.text} />
            </label>
          );
        })}
      </div>
      <div className={s.row}>
        <button disabled={idx === 0} onClick={() => go(idx - 1)}>Forrige</button>
        <button disabled={idx === qs.length - 1} onClick={() => go(idx + 1)}>Neste</button>
        <button disabled={!got(q).length} onClick={() => clear(q)}>Fjern svar</button>
      </div>
      <div className={s.row}>
        {qs.map((x, n) => (
          <button
            key={x.id}
            aria-label={`Gå til spørsmål ${n + 1}`}
            className={`${s.nav} ${got(x).length ? s.done : ""} ${n === idx ? s.cur : ""}`}
            onClick={() => go(n)}
          >
            {n + 1}
          </button>
        ))}
      </div>
      <button className={s.primary} onClick={submit}>Lever eksamen</button>
    </>
  );
}
