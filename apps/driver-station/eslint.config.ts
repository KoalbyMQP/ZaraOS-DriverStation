import repo from "@repo/eslint-config";
import { defineConfig } from "eslint/config";

export default defineConfig([
  ...repo.next,
  ...repo.base,
  {
    files: ["**/*.{js,mjs,cjs,jsx,mjsx,cjsx,ts,mts,cts,tsx,mtsx,ctsx}"],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
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
]);
