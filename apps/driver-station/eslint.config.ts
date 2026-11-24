import repo from "@repo/eslint-config";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["test-results/**", "playwright-report/**", "blob-report/**"]),
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
]);
