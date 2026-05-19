import Image from "next/image";
import Link from "next/link";
import { Project } from "@/lib/types";
import { formatIndex } from "@/lib/projects";

interface ProjectCardProps {
  project: Project;
  index: number;
  total: number;
}

function PlaceholderArt({
  project,
  variant,
}: {
  project: Project;
  variant: number;
}) {
  if (project.type === "textile") {
    if (variant % 3 === 0) {
      return (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "var(--color-ink)" }}
        >
          <div
            style={{
              width: "62%",
              height: "78%",
              border: "1px solid var(--color-canvas)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: "12%",
                border: "1px solid var(--color-canvas)",
                opacity: 0.4,
              }}
            />
          </div>
        </div>
      );
    }
    if (variant % 3 === 1) {
      return (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "var(--color-ink)" }}
        >
          <div
            className="rounded-full"
            style={{
              width: "60%",
              aspectRatio: "1",
              border: "2px solid var(--color-canvas)",
            }}
          />
        </div>
      );
    }
    return (
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ background: "var(--color-accent)" }}
      >
        <div className="flex items-end gap-3" style={{ height: "60%" }}>
          {[40, 70, 95, 60, 85].map((h, i) => (
            <div
              key={i}
              style={{
                width: "12px",
                height: `${h}%`,
                background: "var(--color-ink)",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (variant % 2 === 0) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ background: "#1A1814" }}
      >
        <div className="flex flex-col gap-2 items-stretch" style={{ width: "62%" }}>
          {[100, 60, 85, 40, 95, 55, 70].map((w, i) => (
            <div
              key={i}
              style={{
                height: "2px",
                width: `${w}%`,
                background: "var(--color-canvas)",
                opacity: i % 2 === 0 ? 0.7 : 1,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: "var(--color-ink)" }}
    >
      <div
        className="grid grid-cols-4 grid-rows-4 gap-2"
        style={{ width: "60%", aspectRatio: "1" }}
      >
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: "var(--color-canvas)",
              opacity: i % 4 === i % 5 ? 1 : 0.25,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ProjectCard({
  project,
  index,
  total,
}: ProjectCardProps) {
  return (
    <article data-tile-id={index} className="relative group">
      <Link
        href={`/project/${project.slug}`}
        className="block rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--color-accent)]"
      >
        <div
          className="relative w-full overflow-hidden"
          style={{
            aspectRatio: project.aspectRatio,
            transition: "box-shadow 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
            boxShadow: "0 18px 50px -20px rgba(0,0,0,0.18)",
          }}
        >
          {project.coverImage ? (
            <Image
              src={project.coverImage.src}
              alt={project.coverImage.alt}
              width={project.coverImage.width}
              height={project.coverImage.height}
              className="absolute inset-0 h-full w-full object-cover"
              sizes="(min-width: 1024px) 40vw, 100vw"
            />
          ) : (
            <PlaceholderArt project={project} variant={index} />
          )}
        </div>
        <div className="mt-5 flex items-baseline justify-between gap-6">
          <h2
            className="font-display"
            style={{
              fontSize: "clamp(1.25rem, 2.4vw, 1.875rem)",
              lineHeight: 1,
              letterSpacing: "-0.01em",
            }}
          >
            {project.title}
          </h2>
          <span className="text-mono-meta whitespace-nowrap opacity-65">
            {formatIndex(index)} / {String(total).padStart(3, "0")}
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-snug opacity-65 max-w-[380px]">
          {project.summary}
        </p>
      </Link>
    </article>
  );
}
