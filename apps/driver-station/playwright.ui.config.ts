import { defineConfig } from "@playwright/test";
import authConfig from "./playwright.auth.config";

export default defineConfig(authConfig, {
  testMatch: ["auth-guard.spec.ts", "shell.spec.ts"],
});
