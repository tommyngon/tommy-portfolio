import Collection from "@/components/studio/Collection";
import LandingSheet from "@/components/LandingSheet";
import NameLetters from "@/components/studio/NameLetters";
import StoneEnd from "@/components/studio/StoneEnd";
import { LANDING_ONLY } from "@/lib/launch";
import s from "./home.module.css";

// The landing sheet first; scrolling down walks straight into the collection (held back on
// the live site while it is in progress, see lib/launch.ts). The name stays pinned just above
// the statement the whole way down, behind the sheets and the text, in front of the index.
// At the end it turns into a stone on a slide of its own and back into the name, which comes
// to rest large at the very bottom under place and contact (StoneEnd).
export default function Home() {
  return (
    <main id="main" className={s.home}>
      <LandingSheet />
      {LANDING_ONLY ? null : <Collection footer={false} />}
      <div className={s.pin} data-name-pin="">
        <p className={s.name}>
          <NameLetters />
        </p>
      </div>
      <StoneEnd />
    </main>
  );
}
