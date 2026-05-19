import type { MetadataRoute } from "next";
import { projects } from "@/lib/projects";

const BASE_URL = "https://tommy-portfolio.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];

  for (const project of projects) {
    routes.push({
      url: `${BASE_URL}/project/${project.slug}`,
      lastModified: new Date(project.date),
      changeFrequency: "yearly",
      priority: 0.8,
    });
  }

  return routes;
}
