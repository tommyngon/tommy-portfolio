import LoadingScreen from "@/components/LoadingScreen";
import Header from "@/components/Header";
import SectionIndicator from "@/components/SectionIndicator";
import ProjectCard from "@/components/ProjectCard";
import ContactSection from "@/components/ContactSection";
import { projects } from "@/lib/projects";

export default function Home() {
  return (
    <main
      className="relative min-h-screen"
      style={{ background: "var(--color-canvas)", color: "var(--color-ink)" }}
    >
      <LoadingScreen />
      <Header />
      <SectionIndicator />

      <div className="mx-auto" style={{ maxWidth: "min(520px, 60vw)" }}>
        {/* Hero */}
        <section className="pt-44 pb-32">
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(1.75rem, 3vw, 2.5rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            Index of a portfolio
            <br />
            where code and craft
            <br />
            are built the same way.
          </h1>
        </section>

        {/* Project Index */}
        <section className="space-y-28 pb-40">
          {projects.map((project, index) => (
            <ProjectCard
              key={project.slug}
              project={project}
              index={index}
              total={projects.length}
            />
          ))}
        </section>

        <ContactSection />
      </div>
    </main>
  );
}
