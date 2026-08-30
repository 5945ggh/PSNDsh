import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-ical depends on Node-only Temporal internals and must not be bundled by Turbopack.
  serverExternalPackages: ["node-ical"],
  // Allow the iPhone to load Turbopack's development resources over the LAN.
  // Keep this limited to the developer machine's current private-network host.
  allowedDevOrigins: ["192.168.1.65"],
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
