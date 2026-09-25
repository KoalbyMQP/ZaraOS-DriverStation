//  @ts-check

import repo from "@repo/eslint-config";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["apps/**/*", "packages/**/*"]),
  ...repo.base,
  ...repo.json,
  ...repo.markdown,
]);
