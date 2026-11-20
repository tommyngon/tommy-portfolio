// Budgets for phones and tablets: touch only, no mouse or trackpad (attaching one flips it).
// Their sheets are a third of a laptop's in css px and their GPUs a fraction of one, so the
// live pictures are drawn smaller and change at most 30 times a second, and the canvases cap
// their pixel ratio lower. What follows the finger (the scroll, the bend) still runs every
// frame. Everywhere else this is false and nothing changes.
export const HANDHELD_QUERY = "(hover: none) and (pointer: coarse)";
export const handheld = () => typeof window !== "undefined" && window.matchMedia(HANDHELD_QUERY).matches;

export const HANDHELD_SCALE = 0.7; // a live source's backing store, of the size asked for
export const HANDHELD_DPR = 1.5; // the most backing px per css px for a full-size GL canvas
export const HANDHELD_FRAME = 1 / 30 - 0.004; // s between two changed pictures: a hair under 1/30, so 60 Hz lands on every other frame, never every third
