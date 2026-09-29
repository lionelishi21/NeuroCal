import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Contracts ship as TypeScript source from the workspace.
  transpilePackages: ["@neurocal/contracts"],
};

export default config;
