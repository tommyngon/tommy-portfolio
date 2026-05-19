import { notFound } from "next/navigation";
import Link from "next/link";
import { projects, getProjectBySlug, getProjectIndex, formatIndex } from "@/lib/projects";
import type { Metadata } from "next";

export async function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/project/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) {
    return {
      title: "Not Found — Tommy",
      description: "This project could not be found.",
    };
  }

  return {
    title: `${project.title} — Tommy`,
    description: project.summary,
  };
}

export default async function ProjectPage({
  params,
}: PageProps<"/project/[slug]">) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);

  if (!project) notFound();

  const index = getProjectIndex(slug);
  const total = projects.length;
  const nextProject = projects[(index + 1) % total];
  const prevProject = projects[(index - 1 + total) % total];

  const navLinkClass =
    "font-display block transition-colors duration-500 hover:text-[color:var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--color-accent)] rounded-sm";
  const externalLinkClass =
    "font-display text-lg transition-colors hover:text-[color:var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)] rounded-sm";

  return (
    <main
      className="relative min-h-screen"
      style={{ background: "var(--color-canvas)", color: "var(--color-ink)" }}
    >
      {/* Back nav */}
      <div className="fixed top-6 md:top-8 left-6 md:left-10 z-40">
        <Link
          href="/"
          className="font-display select-none transition-colors hover:text-[color:var(--color-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)] rounded-sm"
          style={{
            fontSize: "clamp(1.75rem, 2.4vw, 2.25rem)",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          Tommy<span style={{ color: "var(--color-accent)" }}>&reg;</span>
        </Link>
      </div>

      {/* Project index label */}
      <div className="fixed top-6 md:top-8 right-6 md:right-10 z-40 text-mono-meta opacity-65">
        {formatIndex(index)} / {String(total).padStart(3, "0")}
      </div>

      <div className="mx-auto px-6" style={{ maxWidth: "720px" }}>
        {/* Header */}
        <section className="pt-44 pb-16">
          <div className="text-mono-meta opacity-65 mb-4">
            {project.type === "textile" ? "Textile" : "Code"} &middot;{" "}
            {project.date}
          </div>
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(2rem, 4vw, 3.5rem)",
              lineHeight: 0.92,
              letterSpacing: "-0.02em",
            }}
          >
            {project.title}
          </h1>
          <p className="mt-6 text-[15px] leading-relaxed opacity-70 max-w-[520px]">
            {project.summary}
          </p>
        </section>

        {/* Tags */}
        <section className="pb-12 flex flex-wrap gap-2">
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="text-mono-meta px-3 py-1.5 border"
              style={{ borderColor: "var(--color-line)", opacity: 0.65 }}
            >
              {tag}
            </span>
          ))}
        </section>

        {/* Type-specific content */}
        {project.type === "code" && (
          <section className="pb-16">
            <div
              className="border-t py-8"
              style={{ borderColor: "var(--color-ink)" }}
            >
              <div className="text-mono-meta opacity-65 mb-4">Tech Stack</div>
              <div className="flex flex-wrap gap-3">
                {project.techStack.map((tech) => (
                  <span
                    key={tech}
                    className="font-display text-lg"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
            {project.repo && (
              <div
                className="border-t py-8"
                style={{ borderColor: "var(--color-ink)" }}
              >
                <div className="text-mono-meta opacity-65 mb-4">
                  Source Code
                </div>
                <a
                  href={project.repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={externalLinkClass}
                >
                  View on GitHub &rarr;
                </a>
              </div>
            )}
            {project.liveUrl && (
              <div
                className="border-t py-8"
                style={{ borderColor: "var(--color-ink)" }}
              >
                <div className="text-mono-meta opacity-65 mb-4">Live</div>
                <a
                  href={project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={externalLinkClass}
                >
                  Visit Site &rarr;
                </a>
              </div>
            )}
          </section>
        )}

        {project.type === "textile" && (
          <section className="pb-16">
            <div
              className="border-t py-8"
              style={{ borderColor: "var(--color-ink)" }}
            >
              <div className="text-mono-meta opacity-65 mb-4">Materials</div>
              <div className="space-y-1">
                {project.materials.map((mat) => (
                  <div key={mat} className="text-[15px]">
                    {mat}
                  </div>
                ))}
              </div>
            </div>
            <div
              className="border-t py-8"
              style={{ borderColor: "var(--color-ink)" }}
            >
              <div className="text-mono-meta opacity-65 mb-4">Techniques</div>
              <div className="space-y-1">
                {project.techniques.map((tech) => (
                  <div key={tech} className="text-[15px]">
                    {tech}
                  </div>
                ))}
              </div>
            </div>
            {project.dimensions && (
              <div
                className="border-t py-8"
                style={{ borderColor: "var(--color-ink)" }}
              >
                <div className="text-mono-meta opacity-65 mb-4">
                  Dimensions
                </div>
                <div className="text-[15px]">{project.dimensions}</div>
              </div>
            )}
          </section>
        )}

        {/* Previous / Next project links */}
        <section className="pb-32">
          <div
            className="border-t py-12 grid gap-10 md:grid-cols-2"
            style={{ borderColor: "var(--color-ink)" }}
          >
            <div>
              <div className="text-mono-meta opacity-65 mb-4">Previous</div>
              <Link
                href={`/project/${prevProject.slug}`}
                className={navLinkClass}
                style={{
                  fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                }}
              >
                &larr; {prevProject.title}
              </Link>
            </div>
            <div className="md:text-right">
              <div className="text-mono-meta opacity-65 mb-4">Next</div>
              <Link
                href={`/project/${nextProject.slug}`}
                className={navLinkClass}
                style={{
                  fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                }}
              >
                {nextProject.title} &rarr;
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
