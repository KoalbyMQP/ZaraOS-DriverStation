// @ts-check

import repo from "@repo/eslint-config";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  ...repo.next,
  ...repo.base,
  ...repo.json,
  ...repo.markdown,
  ...repo.css,
  {
    files: ["app/globals.css"],
    rules: {
      // Theme overrides intentionally take precedence over utility classes.
      "css/no-important": "off",
      // The validator misreads nested color variables in --blue-outline.
      "css/no-invalid-properties": "off",
    },
  },
  // Example workflow sources are excluded from this app's lint checks.
  globalIgnores(["workflows/**"]),
]);
