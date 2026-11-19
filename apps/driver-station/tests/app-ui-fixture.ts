import { fileURLToPath } from "node:url";
import { test as authenticatedTest, expect } from "./ui-fixture";

export { expect };
export const remoteOrigin = "https://app-ui.test";
export const remoteHeaders = { "access-control-allow-origin": "*" };
export const descriptor = {
  schemaVersion: 1,
  sdkVersion: 1,
  appId: "test-app",
  appVersion: "1.0.0",
  federation: { name: "zara_test_ui_v1", entry: "./mf-manifest.json", type: "module" },
  pages: {
    overview: { title: "Overview", module: "./Overview" },
    settings: { title: "Settings", module: "./Settings" },
    broken: { title: "Broken page", module: "./Broken" },
  },
  components: { counter: { title: "Counter", module: "./Counter" } },
};

const manifest = {
  id: "zara_test_ui_v1",
  name: "zara_test_ui_v1",
  metaData: {
    name: "zara_test_ui_v1",
    globalName: "zara_test_ui_v1",
    buildInfo: { buildVersion: "1", buildName: "test-fixture" },
    publicPath: `${remoteOrigin}/`,
    remoteEntry: { name: "remoteEntry.js", path: "", type: "module" },
  },
  shared: [],
  remotes: [],
  exposes: ["Overview", "Settings", "Broken", "Counter"].map((name) => ({
    id: `zara_test_ui_v1:${name}`,
    name,
    path: `./${name}`,
    assets: { js: { sync: [], async: [] }, css: { sync: [], async: [] } },
  })),
};

export const test = authenticatedTest.extend<{ appUiRemote: void }>({
  appUiRemote: [
    async ({ page }, use) => {
      await page.route(`${remoteOrigin}/zara-ui.json`, (route) =>
        route.fulfill({ json: descriptor, headers: remoteHeaders })
      );
      await page.route(`${remoteOrigin}/mf-manifest.json`, (route) =>
        route.fulfill({ json: manifest, headers: remoteHeaders })
      );
      for (const [file, contentType] of [
        ["remoteEntry.js", "text/javascript"],
        ["counter.css", "text/css"],
      ]) {
        await page.route(`${remoteOrigin}/${file}`, (route) =>
          route.fulfill({
            path: fileURLToPath(new URL(`./fixtures/app-ui/${file}`, import.meta.url)),
            contentType,
            headers: remoteHeaders,
          })
        );
      }
      await use();
    },
    { auto: true },
  ],
});
