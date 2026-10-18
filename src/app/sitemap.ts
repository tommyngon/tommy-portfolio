import type { MetadataRoute } from "next";
import { LANDING_ONLY, SITE_URL as BASE_URL } from "@/lib/launch";
import { PROJECTS } from "@/lib/work";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (path: string, priority: number): MetadataRoute.Sitemap[number] => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority,
  });
  if (LANDING_ONLY) return [page("/", 1)];
  return [
    page("/", 1),
    page("/work", 0.9),
    ...PROJECTS.map((p) => page(`/work/${p.slug}`, 0.8)),
    page("/uniform", 0.7),
    page("/about", 0.6),
  ];
}
