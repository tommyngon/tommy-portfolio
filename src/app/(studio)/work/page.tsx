import type { Metadata } from "next";
import Collection from "@/components/studio/Collection";

export const metadata: Metadata = {
  title: "work — Tommy Ngo Nguyen",
  description: "Clothing, software, a company. Selected work by Tommy Ngo Nguyen, Trondheim, Norway.",
};

export default function WorkPage() {
  return (
    <main id="main">
      <h1 className="sr-only">Work — Tommy Ngo Nguyen</h1>
      <Collection />
    </main>
  );
}
