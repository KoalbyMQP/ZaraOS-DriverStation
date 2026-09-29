import { defineConfig } from "oxfmt";
import repo from "./index.ts";

export default defineConfig({
  ...repo.base,
  ignorePatterns: ["dist/", "build/", "coverage/", "*.tsbuildinfo"],
});
