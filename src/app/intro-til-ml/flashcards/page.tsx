import Link from "next/link";
import Flashcards from "../_components/Flashcards";
import raw from "../_data/flashcards.json";
import type { StudyData } from "../_data/types";

export default function Page() {
  return (
    <>
      <p><Link href="/intro-til-ml">← Intro til ML</Link></p>
      <h1>Flashcards, quiz og koble sammen</h1>
      <Flashcards data={raw as StudyData} />
    </>
  );
}
