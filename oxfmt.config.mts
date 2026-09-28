import repo from "@repo/oxfmt-config";
import { defineConfig } from "oxfmt";

export default defineConfig({
  ...repo.base,
  ignorePatterns: ["apps/**", "packages/**", "*.tsbuildinfo"],
});
