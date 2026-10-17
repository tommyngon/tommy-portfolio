import "@/components/studio/tokens.css";
import { studioFontVars } from "@/components/studio/fonts";
import SmoothScroll from "@/components/studio/SmoothScroll";
import Preloader from "@/components/studio/Preloader";
import Header from "@/components/studio/Header";
import PageTransition from "@/components/studio/PageTransition";
import ContactDialog from "@/components/studio/ContactDialog";
import shell from "@/components/studio/shell.module.css";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`studio ${studioFontVars}`}>
      <a href="#main" className={`${shell.skipLink} ui-caps`}>
        Skip to content
      </a>
      <SmoothScroll>
        <Preloader />
        <Header />
        <PageTransition>{children}</PageTransition>
        <ContactDialog />
      </SmoothScroll>
    </div>
  );
}
