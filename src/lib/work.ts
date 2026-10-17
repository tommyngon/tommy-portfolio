// Projects shown on the studio pages (/work, /work/[slug], /about). Facts supplied by Tommy;
// images live in /public/work/ (prepared by the asset step).

export type WorkImage = { src: string; alt: string };

export type Project = {
  slug: string;
  title: string;
  summary: string;
  specs: { label: string; value: string }[];
  outcome: string; // bottom-left line (the reference's price line)
  credit: string; // bottom-left small line (the reference's maker line)
  link?: { label: string; href: string };
  images: [WorkImage, WorkImage, WorkImage];
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
    images: [
      { src: "/work/qbikk-1.webp", alt: "QBIKK: the glass cube and voice preview" },
      { src: "/work/qbikk-2.webp", alt: "QBIKK: the cube reacting to a voice note" },
      { src: "/work/qbikk-3.webp", alt: "QBIKK: remembered items after a voice note" },
    ],
  },
  {
    slug: "tomatosharp",
    title: "Tomatosharp Academy",
    summary: "An onboarding site for the staff of a knife store: a daily knife, three learning paths, a progress board.",
    specs: [
      { label: "Role", value: "Employee" },
      { label: "Started", value: "2026" },
      { label: "Built with", value: "AI, in HTML, CSS and JavaScript — no framework" },
      { label: "Type", value: "Web app" },
    ],
    outcome: "tomatosharp-academy.vercel.app",
    credit: "Built for Tomatosharp",
    link: { label: "Visit the site", href: "https://tomatosharp-academy.vercel.app/" },
    images: [
      { src: "/work/tomatosharp-1.webp", alt: "Tomatosharp Academy: front page with the knife of the day" },
      { src: "/work/tomatosharp-2.webp", alt: "Tomatosharp Academy: practice topics" },
      { src: "/work/tomatosharp-3.webp", alt: "Tomatosharp Academy: a photo quiz question" },
    ],
  },
  {
    slug: "som",
    title: "söm",
    summary: "Clothing drafted, cut and sewn by hand. Söm is Swedish for seam.",
    specs: [
      { label: "Role", value: "Designer and maker" },
      { label: "Started", value: "2024" },
      { label: "Status", value: "Ongoing" },
      { label: "Type", value: "Clothing" },
    ],
    outcome: "Made by hand, in small numbers",
    credit: "Sewn by Tommy Ngo Nguyen in Trondheim, Norway",
    images: [
      { src: "/work/som-1.webp", alt: "söm: placeholder print, front" },
      { src: "/work/som-2.webp", alt: "söm: placeholder print, profile" },
      { src: "/work/som-3.webp", alt: "söm: placeholder print, back" },
    ],
  },
];

export const getProject = (slug: string) => PROJECTS.find((p) => p.slug === slug);

// every image in the order shown on /work's image column
export const COLUMN = PROJECTS.flatMap((p) => p.images.map((img) => ({ ...img, href: `/work/${p.slug}` })));
