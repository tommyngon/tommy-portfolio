import { Project } from "./types";

export const projects: Project[] = [
  {
    slug: "handmade-tote",
    title: "Handmade Tote",
    date: "2026-03-15",
    summary: "A structured canvas tote bag with reinforced stitching and custom lining.",
    tags: ["sewing", "accessories", "canvas"],
    coverImage: {
      src: "/images/placeholder-textile-1.svg",
      alt: "Handmade canvas tote bag",
      width: 800,
      height: 1000,
    },
    aspectRatio: "4 / 5",
    type: "textile",
    materials: ["12oz canvas", "Cotton lining", "Brass hardware"],
    techniques: ["Flat-felled seams", "Box corners", "Topstitching"],
  },
  {
    slug: "portfolio-site",
    title: "Portfolio Site",
    date: "2026-05-01",
    summary: "A brutalist editorial portfolio built with Next.js and Tailwind CSS.",
    tags: ["web", "next.js", "design"],
    coverImage: {
      src: "/images/placeholder-code-1.svg",
      alt: "Portfolio website screenshot",
      width: 1000,
      height: 800,
    },
    aspectRatio: "5 / 4",
    type: "code",
    repo: "https://github.com/tommynguyen/tommy-portfolio",
    techStack: ["Next.js", "TypeScript", "Tailwind CSS"],
  },
  {
    slug: "linen-shirt",
    title: "Linen Shirt",
    date: "2026-02-10",
    summary: "A relaxed-fit linen button-down with French seams throughout.",
    tags: ["sewing", "garment", "linen"],
    coverImage: {
      src: "/images/placeholder-textile-2.svg",
      alt: "Linen button-down shirt",
      width: 800,
      height: 800,
    },
    aspectRatio: "1 / 1",
    type: "textile",
    materials: ["Irish linen", "Corozo buttons", "Silk thread"],
    techniques: ["French seams", "Collar construction", "Buttonhole placement"],
  },
  {
    slug: "denim-jacket",
    title: "Denim Jacket",
    date: "2026-01-20",
    summary: "A classic trucker-style jacket in raw selvedge denim with custom hardware.",
    tags: ["sewing", "garment", "denim"],
    coverImage: {
      src: "/images/placeholder-textile-3.svg",
      alt: "Raw selvedge denim jacket",
      width: 1000,
      height: 800,
    },
    aspectRatio: "5 / 4",
    type: "textile",
    materials: ["14oz selvedge denim", "Copper rivets", "YKK zipper"],
    techniques: ["Flat-felled seams", "Welt pockets", "Bar tacking"],
  },
];

export function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export function getProjectIndex(slug: string): number {
  return projects.findIndex((p) => p.slug === slug);
}

export function formatIndex(index: number): string {
  return String(index + 1).padStart(3, "0");
}
