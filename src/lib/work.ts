// Projects shown on the studio pages (/work, /work/[slug], /about). Facts supplied by Tommy;
// images live in /public/work/ (prepared by the asset step).

export type WorkImage = { src: string; alt: string };
export type LiveKind = "orb" | "keys";

export type Project = {
  slug: string;
  title: string;
  summary: string;
  specs: { label: string; value: string }[];
  outcome: string; // bottom-left line (the reference's price line)
  credit: string; // bottom-left small line (the reference's maker line)
  link?: { label: string; href: string };
  images?: WorkImage[]; // omitted until the project has pictures
  // the one sheet this project gets in the scrolling column; `live` swaps the still for an
  // animated source (the still stays as the fallback without WebGL or with reduced motion).
  // `mark` is a transparent sheet-sized layer drawn on top of the live source, in white.
  cover?: WorkImage & { live?: LiveKind; mark?: string };
};

export const PROJECTS: Project[] = [
  {
    slug: "qbikk",
    title: "QBIKK",
    summary: "A pocket-sized AI secretary — your perfect memory.",
    specs: [
      { label: "Role", value: "Head of product" },
      { label: "Started", value: "2026" },
      { label: "Status", value: "In development" },
      { label: "Type", value: "Startup" },
    ],
    outcome: "qbikk.com",
    credit: "QBIKK, Trondheim, Norway",
    link: { label: "qbikk.com", href: "https://qbikk.com" },
    cover: { src: "/work/qbikk-sheet.webp", alt: "QBIKK: the wordmark over the AI orb", live: "orb", mark: "/work/qbikk-mark.webp" },
    images: [
      { src: "/work/qbikk-1.webp", alt: "QBIKK: the glass cube and voice preview" },
      { src: "/work/qbikk-2.webp", alt: "QBIKK: the cube reacting to a voice note" },
      { src: "/work/qbikk-3.webp", alt: "QBIKK: remembered items after a voice note" },
    ],
  },
  {
    slug: "tomatosharp-academy",
    title: "Tomatosharp Academy",
    summary: "An onboarding site for the staff of a knife store: a daily knife, three learning paths, a progress board.",
    specs: [
      { label: "Role", value: "Employee" },
      { label: "Started", value: "2026" },
      { label: "Built with", value: "AI, in HTML, CSS and JavaScript — no framework" },
      { label: "Type", value: "Onboarding site" },
    ],
    outcome: "tomatosharp-academy.vercel.app",
    credit: "Built for Tomatosharp",
    link: { label: "Visit the site", href: "https://tomatosharp-academy.vercel.app/" },
    cover: { src: "/work/tomatosharp-sheet.webp", alt: "Tomatosharp Academy: logo over a Japanese knife on black leather" },
    images: [
      { src: "/work/tomatosharp-1.webp", alt: "Tomatosharp Academy: front page with the knife of the day" },
      { src: "/work/tomatosharp-2.webp", alt: "Tomatosharp Academy: practice topics" },
      { src: "/work/tomatosharp-3.webp", alt: "Tomatosharp Academy: a photo quiz question" },
    ],
  },
  {
    slug: "stackwise",
    title: "Stackwise",
    summary: "A browser Tetris skill trainer: pick a skill, see the target placement and exact keys, practice it, and get an explanation of why.",
    specs: [
      { label: "Type", value: "Tetris skill trainer" },
      { label: "Lessons", value: "20 lessons in 4 tiers, 208 validated scenarios" },
      { label: "Modes", value: "Watch, Guided, Practice, Challenge and Free Play with an engine coach" },
      { label: "Built with", value: "Vanilla JavaScript on a canvas — no framework, with its own SRS engine" },
    ],
    outcome: "stackwise-tetris.vercel.app",
    credit: "Tommy Ngo Nguyen, Trondheim, Norway",
    link: { label: "Visit the site", href: "https://stackwise-tetris.vercel.app" },
    cover: { src: "/work/stackwise-sheet.webp", alt: "Stackwise: isometric keyboard keycaps", live: "keys" },
    images: [
      { src: "/work/stackwise-1.webp", alt: "Stackwise: front page with the wordmark and keycaps" },
      { src: "/work/stackwise-2.webp", alt: "Stackwise: a guided lesson showing the target placement and the keys to press" },
      { src: "/work/stackwise-3.webp", alt: "Stackwise: Free Play with the engine coach suggesting the best placement" },
    ],
  },
  {
    slug: "staerk",
    title: "Staerk",
    summary: "A strength-training logger: pick a body part, roll the dials, log the set, and follow your progress over time.",
    specs: [
      { label: "Started", value: "2026" },
      { label: "Status", value: "In development" },
      { label: "Built with", value: "React and TypeScript, installable as an app" },
      { label: "Type", value: "Training logger" },
    ],
    outcome: "staerk.vercel.app",
    credit: "Tommy Ngo Nguyen, Trondheim, Norway",
    link: { label: "Visit the site", href: "https://staerk.vercel.app" },
    cover: { src: "/work/staerk-sheet.webp", alt: "Staerk: the wordmark in ink over white embossed paper with a loading spinner" },
    images: [
      { src: "/work/staerk-1.webp", alt: "Staerk: opening screen with the wordmark on silver foil" },
      { src: "/work/staerk-2.webp", alt: "Staerk: logging a set with the reps and weight dials" },
      { src: "/work/staerk-3.webp", alt: "Staerk: progress chart ending at a new best" },
    ],
  },
  {
    slug: "artefakt-archive",
    title: "artefakt archive",
    summary: "Clothing drafted, cut and sewn by hand.",
    specs: [
      { label: "Role", value: "Designer and maker" },
      { label: "Started", value: "2024" },
      { label: "Status", value: "Ongoing" },
      { label: "Type", value: "Clothing and products" },
    ],
    outcome: "Made by hand, in small numbers",
    credit: "Sewn by Tommy Ngo Nguyen in Trondheim, Norway",
    cover: { src: "/work/artefakt-sheet.webp", alt: "artefakt archive: logo over a loosely woven red textile" },
    images: [
      { src: "/work/som-1.webp", alt: "artefakt archive: placeholder print, front" },
      { src: "/work/som-2.webp", alt: "artefakt archive: placeholder print, profile" },
      { src: "/work/som-3.webp", alt: "artefakt archive: placeholder print, back" },
    ],
  },
  {
    slug: "huskelappen",
    title: "Huskelappen",
    summary: "An application.",
    specs: [{ label: "Type", value: "Application" }],
    outcome: "More soon.",
    credit: "Tommy Ngo Nguyen, Trondheim, Norway",
    cover: { src: "/work/huskelappen-sheet.webp", alt: "Huskelappen: the app icon and name" },
  },
];

export const getProject = (slug: string) => PROJECTS.find((p) => p.slug === slug);

// the scrolling column: one sheet per project, in project order
export const COLUMN = PROJECTS.flatMap((p) =>
  p.cover ? [{ ...p.cover, href: `/work/${p.slug}`, caption: p.title }] : [],
);
