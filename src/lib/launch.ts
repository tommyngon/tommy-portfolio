// The live site is a single page for now: only the landing sheet. The full studio (the
// collection, /work, /about, /uniform) keeps growing in development, where everything shows.
// To ship it, set NEXT_PUBLIC_FULL_SITE=1 in the deployment's environment (or drop this flag).
// next.config.ts repeats this check for its redirects.
export const LANDING_ONLY =
  process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_FULL_SITE !== "1";

export const SITE_URL = "https://tommynguyen.no";
