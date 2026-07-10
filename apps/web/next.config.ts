import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disabled on Vercel — babel-plugin-react-compiler is a devDependency and can break serverless builds.

  // Emit a self-contained server bundle (.next/standalone) for the Docker image.
  // Ignored by Vercel, which handles its own output packaging.
  output: "standalone",
};

export default nextConfig;
