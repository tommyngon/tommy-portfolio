import type { NextConfig } from "next";

// same check as LANDING_ONLY in src/lib/launch.ts: the live site is the landing sheet alone
const landingOnly = process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_FULL_SITE !== "1";

const nextConfig: NextConfig = {
  // keep the dev badge off the canvas; build and runtime errors still surface
  devIndicators: false,
  async redirects() {
    // temporary (307), so the pages can come back without browsers remembering the redirect
    const hidden = ["/work", "/work/:path*", "/about", "/uniform"].map((source) => ({
      source,
      destination: "/",
      permanent: false,
    }));
    if (landingOnly) return hidden;
    return [
      { source: "/work/som", destination: "/work/artefakt-archive", permanent: true },
      { source: "/work/tomatosharp", destination: "/work/tomatosharp-academy", permanent: true },
    ];
  },
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
