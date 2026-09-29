import repo from "@repo/oxfmt-config";
import { defineConfig } from "oxfmt";

export default defineConfig({
  ...repo.base,
  sortTailwindcss: {
    stylesheet: "./app/globals.css",
  },
  ignorePatterns: [
    ".next/",
    ".turbo/",
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
    "playwright/.auth/",
  ],
});
