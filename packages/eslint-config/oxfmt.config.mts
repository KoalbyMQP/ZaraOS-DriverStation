import repo from "@repo/oxfmt-config";
import { defineConfig } from "oxfmt";

export default defineConfig({
  ...repo.base,
  ignorePatterns: ["dist/", "build/", "coverage/", "*.tsbuildinfo"],
});
