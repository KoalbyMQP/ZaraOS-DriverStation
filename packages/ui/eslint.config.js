import repo from "@repo/eslint-config";
import { defineConfig } from "eslint/config";

export default defineConfig([
  ...repo.base,
  ...repo.react,
  ...repo.tsx,
  ...repo.json,
  ...repo.markdown,
]);
