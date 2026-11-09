// The animated sources a sheet can use in place of its still (`cover.live` in lib/work.ts).
import type { LiveKind } from "@/lib/work";
import { DialSource } from "./dial";
import { KeysSource } from "./keys";
import { OrbSource } from "./orb";
import type { LiveSource } from "./seam";

export function createLiveSource(kind: LiveKind): LiveSource | null {
  if (kind === "orb") return OrbSource.create(512, 640);
  return kind === "keys" ? KeysSource.create(800, 1000) : DialSource.create(800, 1000);
}
