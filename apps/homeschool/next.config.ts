import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for the Docker image,
  // matching apps/web. Ignored by Vercel, which packages its own output.
  output: "standalone",
};

export default nextConfig;
