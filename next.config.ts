import type { NextConfig } from "next";

// same switch as LANDING_ONLY in src/lib/launch.ts: true hides everything but the landing sheet
const landingOnly: boolean = false;

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
