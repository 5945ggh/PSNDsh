import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-ical depends on Node-only Temporal internals and must not be bundled by Turbopack.
  serverExternalPackages: ["node-ical"],
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
