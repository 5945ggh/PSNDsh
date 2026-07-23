import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-ical depends on Node-only Temporal internals and must not be bundled by Turbopack.
  serverExternalPackages: ["node-ical"],
};

export default nextConfig;
