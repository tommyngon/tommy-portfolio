// Midlertidig studieside (Intro til ML). Slettes etter eksamen sammen med hele src/app/intro-til-ml/.
// All tekst er markdown kopiert ordrett fra studiefilene.

export type Option = { key: string; text: string };

export type ExamQuestion = {
  id: string; // "1", "2a", "35b" (2024) eller "1.1" (2025)
  group: string; // 2024: "Oppgave 2 – Linear gradient descent", 2025: "Part 1"
  multi: boolean; // true = "Velg ett eller flere alternativer"
  stem: string; // felles kontekst + spørsmålstekst
  options: Option[];
  correct: string[]; // utledet fasit, f.eks. ["F", "H"]
  alsoAccepted?: string[]; // godkjent ved sensur (2025: 6.4 og 7.4)
  explanation: string; // gjennomgangen for spørsmålet
};

export type Exam = {
  year: "2024" | "2025";
  title: string;
  info: string; // innledende notater fra oppgavetekstfilen
  fasitNote: string; // "Viktig om fasiten" fra gjennomgangsfilen
  scoring: "count" | "nm2025";
  questions: ExamQuestion[];
};

export type Flashcard = { q: string; a: string };
export type Chapter = { title: string; cards: Flashcard[] };
export type QuizQuestion = {
  n: number;
  tag: string; // f.eks. "1.2, regning"
  stem: string;
  options: Option[];
  answer: string; // "B"
  explanation: string; // teksten etter "**B** – " i fasiten
};
export type StudyData = { chapters: Chapter[]; quiz: QuizQuestion[] };
