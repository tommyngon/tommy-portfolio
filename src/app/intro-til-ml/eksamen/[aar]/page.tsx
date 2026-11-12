import Link from "next/link";
import { notFound } from "next/navigation";
import Exam from "../../_components/Exam";
import raw2024 from "../../_data/exam2024.json";
import raw2025 from "../../_data/exam2025.json";
import type { Exam as ExamData } from "../../_data/types";

const exams = [raw2024 as ExamData, raw2025 as ExamData];

export const dynamicParams = false;

export function generateStaticParams() {
  return exams.map((e) => ({ aar: e.year }));
}

export default async function Page({ params }: { params: Promise<{ aar: string }> }) {
  const { aar } = await params;
  const exam = exams.find((e) => e.year === aar);
  if (!exam) notFound();
  return (
    <>
      <p><Link href="/intro-til-ml">← Intro til ML</Link></p>
      <Exam exam={exam} />
    </>
  );
}
