import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // STATIC_EXPORT=1 (infra/scripts/deploy-web.sh) builds plain files into out/ for S3 + CloudFront:
  // every screen fetches on the client, so nothing needs a server. Each page is out/<route>/index.html.
  ...(process.env.STATIC_EXPORT === "1" ? { output: "export" as const, trailingSlash: true } : {}),
  // Contracts ship as TypeScript source from the workspace.
  transpilePackages: ["@neurocal/contracts"],
};

export default config;
