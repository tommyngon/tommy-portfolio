import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import HoverText from "@/components/HoverText";
import SeamColumn from "@/components/studio/SeamColumn";
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

const NO: Record<string, string> = {
  Role: "Rolle",
  Started: "Startet",
  Status: "Status",
  Type: "Type",
  "Built with": "Bygget med",
  "Head of product": "Produktsjef",
  "In development": "I utvikling",
  Startup: "Oppstart",
  Employee: "Ansatt",
  "AI, in HTML, CSS and JavaScript — no framework": "KI, i HTML, CSS og JavaScript — uten rammeverk",
  "Onboarding site": "Opplæringsside",
  "Designer and maker": "Designer og skaper",
  Ongoing: "Pågående",
  "Clothing and products": "Klær og produkter",
  Application: "Applikasjon",
  Lessons: "Leksjoner",
  Modes: "Moduser",
  "Tetris skill trainer": "Tetris-ferdighetstrener",
  "20 lessons in 4 tiers, 208 validated scenarios": "20 leksjoner i 4 nivåer, 208 validerte scenarioer",
  "Watch, Guided, Practice, Challenge and Free Play with an engine coach":
    "Se, Veiledet, Øv, Utfordring og fritt spill med en motor-coach",
  "Vanilla JavaScript on a canvas — no framework, with its own SRS engine":
    "Ren JavaScript på et canvas — uten rammeverk, med egen SRS-motor",
  "React and TypeScript, installable as an app": "React og TypeScript, kan installeres som app",
  "Training logger": "Treningslogg",
  "A browser Tetris skill trainer: pick a skill, see the target placement and exact keys, practice it, and get an explanation of why.":
    "En Tetris-trener i nettleseren: velg en ferdighet, se målplasseringen og de nøyaktige tastene, øv på den, og få forklart hvorfor.",
  "A strength-training logger: pick a body part, roll the dials, log the set, and follow your progress over time.":
    "En logg for styrketrening: velg en kroppsdel, rull hjulene, logg settet, og følg fremgangen over tid.",
  "A pocket-sized AI secretary — your perfect memory.": "En lommestor KI-sekretær — ditt perfekte minne.",
  "An onboarding site for the staff of a knife store: a daily knife, three learning paths, a progress board.":
    "Et opplæringsområde for de ansatte i en knivbutikk: en daglig kniv, tre læringsløp og en fremdriftstavle.",
  "Clothing drafted, cut and sewn by hand.": "Klær tegnet, skåret og sydd for hånd.",
  "An application.": "En applikasjon.",
  "Made by hand, in small numbers": "Laget for hånd, i små opplag",
  "More soon.": "Mer snart.",
  "QBIKK, Trondheim, Norway": "QBIKK, Trondheim, Norge",
  "Built for Tomatosharp": "Laget for Tomatosharp",
  "Sewn by Tommy Ngo Nguyen in Trondheim, Norway": "Sydd av Tommy Ngo Nguyen i Trondheim, Norge",
  "Tommy Ngo Nguyen, Trondheim, Norway": "Tommy Ngo Nguyen, Trondheim, Norge",
  "← Back": "← Tilbake",
  "Open the catalogue →": "Åpne katalogen →",
  "Next project →": "Neste prosjekt →",
};

// English text with its Norwegian twin for the hover flip; anything unlisted stays plain.
function T({ en, as }: { en: string; as?: "p" }) {
  return NO[en] ? <HoverText en={en} no={NO[en]} as={as} /> : <>{en}</>;
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const index = PROJECTS.findIndex((p) => p.slug === slug);
  const next = PROJECTS[(index + 1) % PROJECTS.length];
  const href = project.link?.href ?? (slug === "artefakt-archive" ? "/uniform" : "/work");
  // only the sheet this project has on the home column, once; `images` stays in the data
  const items = project.cover ? [{ ...project.cover, href, caption: project.title }] : [];

  return (
    <main id="main" className={styles.page}>
      <Link href="/work" className={`ui-caps ${styles.back}`}>
        <T en="← Back" />
      </Link>

      <div className={styles.stage}>
        <div className={styles.hero}>
          <h1 className={`title-caps ${styles.title}`}>{project.title}</h1>
          <dl className={styles.specs}>
            {project.specs.map((s) => (
              <div key={s.label} className={styles.spec}>
                <dt className="ui-caps"><T en={s.label} /></dt>
                <dd><T en={s.value} /></dd>
              </div>
            ))}
          </dl>
        </div>
        <div className={styles.spacer} />
        {items.length > 0 && (
          <>
            <SeamColumn items={items} />
            <div className={styles.tail} />
          </>
        )}
      </div>

      <div className={styles.end}>
        {(project.images ?? []).length === 0 ? (
          <p className={`ui-caps ${styles.summary}`}><T en="More soon." /></p>
        ) : (
          <>
            <p className={styles.summary}><T en={project.summary} /></p>
            <div className={`ui-caps ${styles.meta}`}>
              {project.link ? (
                <a href={project.link.href} target="_blank" rel="noopener noreferrer" className={styles.link}>
                  <T en={project.outcome} /> ↗
                </a>
              ) : (
                <p><T en={project.outcome} /></p>
              )}
              {slug === "artefakt-archive" && (
                <Link href="/uniform" className={styles.link}>
                  <T en="Open the catalogue →" />
                </Link>
              )}
              <p className={styles.credit}><T en={project.credit} /></p>
            </div>
          </>
        )}
        <Link href={`/work/${next.slug}`} className={`ui-caps ${styles.next}`}>
          <T en="Next project →" />
        </Link>
      </div>
    </main>
  );
}
