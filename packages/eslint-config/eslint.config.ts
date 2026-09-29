import repo from "./index.ts";
import { defineConfig } from "eslint/config";

export default defineConfig([
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
]);
