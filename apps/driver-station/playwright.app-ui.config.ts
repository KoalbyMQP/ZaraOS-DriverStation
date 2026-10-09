import { defineConfig } from "@playwright/test";
import authConfig from "./playwright.auth.config";

const production = process.env.APP_UI_TEST_PRODUCTION === "true";
const nextServer = (Array.isArray(authConfig.webServer) ? authConfig.webServer[0] : authConfig.webServer)!;

export default defineConfig({
  ...authConfig,
  testMatch: ["app-ui.spec.ts", "app-ui-contract.spec.ts"],
  webServer: {
    ...nextServer,
    command: production ? "npm run build && npm run start -- --port 3101" : nextServer.command,
    env: { ...nextServer.env, NEXT_DIST_DIR: production ? ".next" : ".next/ui-tests" },
  },
});
