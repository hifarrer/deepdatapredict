import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimal traced server (.next/standalone/server.js) instead of `next start`
  // loading all of node_modules — much smaller resident memory on Railway.
  // scripts/copy-standalone.mjs copies public/ and .next/static/ in after build.
  output: "standalone",
};

export default nextConfig;
