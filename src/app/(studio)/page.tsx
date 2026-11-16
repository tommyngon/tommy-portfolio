import Collection, { SiteFooter } from "@/components/studio/Collection";
import LandingSheet from "@/components/LandingSheet";
import { LANDING_ONLY } from "@/lib/launch";
import s from "./home.module.css";

// The landing sheet first; scrolling down walks straight into the collection (held back on
// the live site while it is in progress, see lib/launch.ts). The name stays pinned just above
// the statement the whole way down, behind the sheets, and ends the page with the footer under it.
export default function Home() {
  return (
    <main id="main" className={s.home}>
      <LandingSheet />
      {LANDING_ONLY ? null : <Collection footer={false} />}
      <div className={s.pin}>
        <p className={s.name}>
          <span>Tommy Ngo Nguyen</span>
        </p>
      </div>
      <SiteFooter className={s.foot} />
    </main>
  );
}
