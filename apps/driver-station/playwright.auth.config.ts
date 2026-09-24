import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "auth-guard.spec.ts",
  workers: 1,
  use: {
    baseURL: "http://localhost:3101",
    browserName: "chromium",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  webServer: {
    command: "npm run dev -- --port 3101",
    url: "http://localhost:3101",
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_AUTH_BYPASS_LOCAL: "false",
      NEXT_PUBLIC_AZURE_CLIENT_ID: "11111111-1111-1111-1111-111111111111",
      NEXT_PUBLIC_AZURE_TENANT_ID: "22222222-2222-2222-2222-222222222222",
      NEXT_PUBLIC_REDIRECT_URI: "http://localhost:3101",
    },
  },
});
