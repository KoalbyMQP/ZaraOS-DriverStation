import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  transpilePackages: ["@repo/ui"],
  experimental: {
    optimizePackageImports: ["@repo/ui/icons"],
  },
};

export default nextConfig;
