// @ts-check

import repo from "./index.js";
import { defineConfig } from "eslint/config";

export default defineConfig([...repo.base, ...repo.json, ...repo.markdown]);
