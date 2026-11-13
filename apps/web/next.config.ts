import path from "node:path";
import type { NextConfig } from "next";

const monorepoRoot = path.join(__dirname, "../..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The app imports deployments/testnet.json and the generated client from the
  // monorepo root, so tracing and Turbopack must start there.
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  transpilePackages: ["@steward/treasury-client"],
};

export default nextConfig;
