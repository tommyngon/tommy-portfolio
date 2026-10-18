import Collection from "@/components/studio/Collection";
import LandingSheet from "@/components/LandingSheet";
import { LANDING_ONLY } from "@/lib/launch";

// The landing sheet first; scrolling down walks straight into the collection (held back on
// the live site while it is in progress, see lib/launch.ts).
export default function Home() {
  return (
    <main id="main">
      <LandingSheet />
      {LANDING_ONLY ? null : <Collection />}
    </main>
  );
}
