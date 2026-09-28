import { defineConfig } from "oxfmt";
import repo from "./index.js";

export default defineConfig({
  ...repo.base,
  ignorePatterns: ["dist/", "build/", "coverage/", "*.tsbuildinfo"],
});
