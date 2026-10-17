// OWNER: agent A. Stub: studio shell (smooth scroll, header, preloader, transitions).
import "@/components/studio/tokens.css";
import { studioFontVars } from "@/components/studio/fonts";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <div className={`studio ${studioFontVars}`}>{children}</div>;
}
