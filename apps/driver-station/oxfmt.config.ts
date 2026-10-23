import repo from "@repo/oxfmt-config";

const config = structuredClone(repo.base);

config.sortTailwindcss = {
  stylesheet: "../../packages/ui/src/styles/globals.css",
};
(config.ignorePatterns ??= []).push(
  ".next/",
  "out/",
  "build/",
  "dist/",
  "coverage/",
  "next-env.d.ts",
  "*.tsbuildinfo",
  "playwright-report/",
  "test-results/",
  "blob-report/",
  "playwright/.cache/",
  "playwright/.auth/"
);

export default config;
