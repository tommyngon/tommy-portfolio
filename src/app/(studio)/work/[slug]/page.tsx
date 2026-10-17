import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QbikkSection from "@/components/qbikk/QbikkSection";
import AcademyFront from "@/components/tomatosharp/AcademyFront";
import UniformCover from "@/components/uniform/UniformCover";
import { PROJECTS, getProject } from "@/lib/work";
import styles from "./project.module.css";

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return { title: "Not found — Tommy Ngo Nguyen" };
  return { title: `${project.title} — Tommy Ngo Nguyen`, description: project.summary };
}

function Piece({ slug }: { slug: string }) {
  if (slug === "qbikk") return <QbikkSection />;
  if (slug === "tomatosharp") return <AcademyFront />;
  if (slug === "som") return <UniformCover />;
  return null;
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const index = PROJECTS.findIndex((p) => p.slug === slug);
  const next = PROJECTS[(index + 1) % PROJECTS.length];

  return (
    <main id="main">
      <div className={styles.first}>
        <h1 className={`title-caps ${styles.title}`}>{project.title}</h1>

        <dl className={styles.specs}>
          {project.specs.map((s) => (
            <div key={s.label} className={styles.spec}>
              <dt>{s.label}:</dt> <dd>{s.value}</dd>
            </div>
          ))}
        </dl>

        <Link href="/work" className={`ui-caps ${styles.back}`}>
          ← BACK
        </Link>

        <div className={styles.meta}>
          <p className={styles.outcome}>
            {project.link ? (
              <a href={project.link.href} target="_blank" rel="noopener noreferrer">
                {project.outcome}
              </a>
            ) : (
              project.outcome
            )}
          </p>
          <p className={styles.credit}>{project.credit}</p>
        </div>

        <ul className={styles.images}>
          {project.images.map((img, i) => (
            <li key={img.src} className={styles.image}>
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="(max-width: 640px) 100vw, 24vw"
                priority={i === 0}
                style={{ objectFit: "cover" }}
              />
            </li>
          ))}
        </ul>
      </div>

      <Piece slug={project.slug} />

      <Link href={`/work/${next.slug}`} className={`ui-caps ${styles.next}`}>
        NEXT PROJECT →
      </Link>
    </main>
  );
}
