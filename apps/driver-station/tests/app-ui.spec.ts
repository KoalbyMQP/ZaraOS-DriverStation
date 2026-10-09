import type { Page } from "@playwright/test";
import { test, expect, descriptor, remoteOrigin, remoteHeaders } from "./app-ui-fixture";

const instance = {
  id: "test-1",
  app: "test-app",
  version: "1.0.0",
  state: "running",
  started_at: null,
  stopped_at: null,
  ui: { descriptor_url: `${remoteOrigin}/zara-ui.json` },
};

async function setup(page: Page, path = "/") {
  await page.route("http://127.0.0.1:8080/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route("http://127.0.0.1:8080/instances", (route) => route.fulfill({ json: { instances: [instance] } }));
  await page.route("http://127.0.0.1:8080/images", (route) =>
    route.fulfill({ json: { images: [{ repository: "local/test-app", tags: ["1.0.0"] }] } })
  );
  await page.addInitScript(() => {
    if (!localStorage.getItem("driver-station-connection"))
      localStorage.setItem(
        "driver-station-connection",
        JSON.stringify({ name: "Test robot", ip: "127.0.0.1:8080", devMode: true })
      );
  });
  await page.goto(path);
}

async function openAppNavigation(page: Page) {
  const trigger = page
    .getByRole("navigation", { name: "Apps", exact: true })
    .getByRole("button", { name: /Test App:/ });
  await expect(trigger).toBeVisible();
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  await expect(page.getByRole("link", { name: "1.0.0 · Overview", exact: true })).toBeVisible();
}

async function loadedModules(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __fixtureModuleRequests?: string[] }).__fixtureModuleRequests ?? []
  );
}

test("renders an App-owned page with shared React, its own layout, CSS and instance services", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await setup(page);
  await page.route("http://127.0.0.1:8080/instances/test-1/api/status", (route) =>
    route.fulfill({ json: { status: "Instance request received" } })
  );
  await openAppNavigation(page);
  expect(await loadedModules(page)).toEqual([]);
  await expect(page.getByRole("link", { name: /Counter|Dashboards/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Add component|Register App UI/ })).toHaveCount(0);
  await page.getByRole("link", { name: "1.0.0 · Overview", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Remote overview" })).toBeVisible();
  await expect(page.getByText("App instance: test-1", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "1.0.0 · Overview" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "Count: 0", exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Count: 0", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Count: 1", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Count: 0", exact: true })).toHaveCount(1);
  await expect(page.locator(".federation-test-counter").first()).toHaveCSS("gap", "12px");
  await page.getByRole("button", { name: "Read App status" }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Instance request received" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("app-page-desktop.png"), animations: "disabled" });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page
    .locator(".federation-test-counter")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().y));
  expect(mobile[1]).toBeGreaterThan(mobile[0]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await openAppNavigation(page);
  await page.getByRole("link", { name: "1.0.0 · Settings" }).click();
  await expect(page.getByRole("heading", { name: "Custom settings" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Sidebar" })).not.toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("app-page-mobile.png"), animations: "disabled" });
  expect(await loadedModules(page)).toEqual(["./Overview", "./Settings"]);
  expect(errors).toEqual([]);
});

test("supports direct page links, refresh, browser back and a default page", async ({ page }) => {
  await setup(page, "/app/test-1?page=settings");
  await expect(page.getByRole("heading", { name: "Custom settings" })).toBeVisible();
  await page.getByLabel("Display name").fill("Front camera");
  await expect(page.getByLabel("Display name")).toHaveValue("Front camera");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Custom settings" })).toBeVisible();
  await openAppNavigation(page);
  await page.getByRole("link", { name: "1.0.0 · Overview" }).click();
  await expect(page.getByRole("heading", { name: "Remote overview" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Custom settings" })).toBeVisible();
  await page.goto("/app/test-1");
  await expect(page.getByRole("heading", { name: "Remote overview" })).toBeVisible();
});

test("contains a crashing page and unmounts the page when its App stops", async ({ page }) => {
  await page.clock.install();
  await setup(page, "/app/test-1?page=broken");
  await expect(page.getByText("This App page could not be displayed.")).toBeVisible();
  await expect(page.locator("#page-content").getByRole("button", { name: "Retry" })).toBeVisible();
  await openAppNavigation(page);
  await page.getByRole("link", { name: "1.0.0 · Overview" }).click();
  await expect(page.getByRole("heading", { name: "Remote overview" })).toBeVisible();
  await page.route("http://127.0.0.1:8080/instances", (route) =>
    route.fulfill({ json: { instances: [{ ...instance, state: "stopped" }] } })
  );
  await page.clock.fastForward(15000);
  await expect(page.getByText("This App is stopped. Start it to use this page.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Remote overview" })).toHaveCount(0);
});

test("retries a failed federation manifest without reloading the host", async ({ page }) => {
  let unavailable = true;
  await page.route(`${remoteOrigin}/mf-manifest.json`, (route) =>
    unavailable ? route.fulfill({ status: 503, body: "Unavailable", headers: remoteHeaders }) : route.fallback()
  );
  await setup(page, "/app/test-1");
  const retry = page.locator("#page-content").getByRole("button", { name: "Retry", exact: true });
  await expect(retry).toBeVisible();
  unavailable = false;
  await retry.click();
  await expect(page.getByRole("heading", { name: "Remote overview" })).toBeVisible();
});

test("rejects malformed and mismatched descriptors before loading remote code", async ({ page }) => {
  let response: unknown = { schemaVersion: 999 };
  await page.route(`${remoteOrigin}/zara-ui.json`, (route) =>
    route.fulfill({ json: response, headers: remoteHeaders })
  );
  await setup(page, "/app/test-1");
  const content = page.locator("#page-content");
  await expect(content.getByRole("alert")).toContainText("Unsupported or invalid UI description");
  expect(await loadedModules(page)).toEqual([]);
  response = { ...descriptor, appVersion: "2.0.0" };
  await content.getByRole("button", { name: "Retry" }).click();
  await expect(content.getByRole("alert")).toContainText("does not match this App version");
  expect(await loadedModules(page)).toEqual([]);
  response = descriptor;
  await content.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: "Remote overview" })).toBeVisible();
});

test("accepts component-only Apps without exposing or loading their components", async ({ page }) => {
  await page.route(`${remoteOrigin}/zara-ui.json`, (route) =>
    route.fulfill({ json: { ...descriptor, pages: {} }, headers: remoteHeaders })
  );
  await setup(page, "/app/test-1");
  await expect(page.getByText("This App has no pages.")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Apps", exact: true })
    .getByRole("button", { name: /Test App:/ })
    .click();
  await expect(page.getByRole("navigation", { name: "Apps", exact: true }).getByRole("link")).toHaveCount(3);
  expect(await loadedModules(page)).toEqual([]);
  await page.goto("/app/test-1?page=counter");
  await expect(page.getByText("This App page is unavailable.")).toBeVisible();
  expect(await loadedModules(page)).toEqual([]);
});

test("handles missing pages and instances without importing a component", async ({ page }) => {
  await setup(page, "/app/test-1?page=__proto__");
  await expect(page.getByText("This App page is unavailable.")).toBeVisible();
  expect(await loadedModules(page)).toEqual([]);
  await page.goto("/app/missing?page=overview");
  await expect(page.getByText("This App instance is unavailable.")).toBeVisible();
  expect(await loadedModules(page)).toEqual([]);
});

test("binds a shared UI build to the selected instance", async ({ page }) => {
  await setup(page);
  await page.route("http://127.0.0.1:8080/instances", (route) =>
    route.fulfill({ json: { instances: [instance, { ...instance, id: "test-2" }] } })
  );
  await page.route("http://127.0.0.1:8080/instances/test-2/api/status", (route) =>
    route.fulfill({ json: { status: "Second instance" } })
  );
  await page.goto("/app/test-2");
  await expect(page.getByText("App instance: test-2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Read App status" }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Second instance" })).toBeVisible();
});
