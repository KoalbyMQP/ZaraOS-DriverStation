import type { Page } from "@playwright/test";
import { test, expect } from "./ui-fixture";

test.use({ viewport: { width: 1440, height: 1024 } });

async function connectDev(page: Page) {
  await page.route("http://127.0.0.1:8080/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.getByRole("button", { name: "Connect to robot: no robot connected" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Dev Mode", exact: true }).click();
  await expect(page.getByRole("button", { name: "Connect to robot: Dev Mode" })).toBeVisible();
}

test("navigation, documentation, account menu, and mobile sidebar use the new shell", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/console");
  await expect(page.getByRole("tab", { name: "Terminal", exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Robot metrics" }).getByText("???")).toHaveCount(6);
  await expect(page.getByRole("button", { name: /Dark mode|Settings|Dev Mode/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Settings", exact: true })).toHaveCount(0);
  const robotNav = page.getByRole("navigation", { name: "Robot", exact: true });
  await expect(robotNav.locator("[aria-haspopup]")).toHaveCount(0);
  await expect(robotNav.getByRole("link")).toHaveCount(3);
  await page.getByRole("link", { name: "Documentation", exact: true }).click();
  await expect(page).toHaveURL(/\/documentation$/);
  await expect(page.getByRole("heading", { name: "User Guide", exact: true })).toBeVisible();
  await expect(page.locator("article.typeset")).toBeVisible();
  await expect(page.getByText("ROBOT CONNECTION", { exact: true })).toHaveCount(0);
  await expect(page.getByText("ACTIVE PROJECTS", { exact: true })).toHaveCount(0);
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("documentation.png") });
  await page.getByRole("link", { name: "Dashboards", exact: true }).click();
  await expect(page.getByText("Dashboards aren't implemented yet.", { exact: true })).toBeVisible();
  await expect(page.locator("#page-content").getByRole("button")).toHaveCount(0);
  await expect(page.locator("#page-content").getByRole("link")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "User Guide" })).toHaveCount(0);
  await page.getByRole("button", { name: "Account menu" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu").getByText("Test User", { exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Logout" })).toBeVisible();
  await expect(page.getByRole("menu")).toHaveCSS("opacity", "1");
  await expect(page.getByRole("menu").getByText("test@example.com")).toBeVisible();
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("account-menu.png") });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Account menu" })).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await page.getByRole("link", { name: "App Store", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Online apps", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Sidebar" })).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("shell-mobile.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("robot dialog handles errors, Dev Mode, Figma icons, and disconnect", async ({ page }, testInfo) => {
  await page.route("http://127.0.0.1:8080/health", (route) => route.abort());
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Connect to robot: no robot connected" });
  await expect(trigger.locator("img")).toHaveAttribute("src", "/icons/robot-disconnected.svg");
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Connect to robot" });
  await expect(dialog.getByRole("button", { name: /Bluetooth/ })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Dev Mode", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Could not reach local Cortex");
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("connection-dialog.png") });
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await connectDev(page);
  const connected = page.getByRole("button", { name: "Connect to robot: Dev Mode" });
  await expect(connected.locator("img")).toHaveAttribute("src", "/icons/robot-connected.svg");
  await expect
    .poll(() =>
      connected
        .locator("img")
        .evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight, img.width, img.height])
    )
    .toEqual([24, 24, 24, 24]);
  await connected.click();
  await dialog.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(trigger).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("driver-station-connection"))).toBeNull();
});

test("network pairing keeps custom ports and signs subsequent robot requests", async ({ page }) => {
  let signed = false;
  await page.route("http://robot.test:9090/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/auth/pair/start") return route.fulfill({ json: { expires_in: 120 } });
    if (path === "/auth/pair/complete") {
      expect(route.request().postDataJSON()).toEqual({ code: "123456", label: "Koalby" });
      return route.fulfill({ json: { salt: "test-salt" } });
    }
    if (path === "/instances") {
      const headers = route.request().headers();
      signed = !!headers["x-timestamp"] && /^[0-9a-f]{64}$/.test(headers["x-signature"] ?? "");
      return route.fulfill({ json: { instances: [] } });
    }
    return route.fulfill({ json: { status: "ok" } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Connect to robot: no robot connected" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Device name").fill("Koalby");
  await dialog.getByLabel("IP address", { exact: true }).fill("robot.test:9090");
  await dialog.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Enter pairing code" })).toBeVisible();
  await dialog.getByLabel("Pairing code", { exact: true }).fill("123456");
  await dialog.getByRole("button", { name: "Pair", exact: true }).click();
  await expect(page.getByRole("button", { name: "Connect to robot: Koalby" })).toBeVisible();
  await expect.poll(() => signed).toBe(true);
});

test("terminal exchanges protocol messages and resizes without reconnecting", async ({ page }, testInfo) => {
  const messages: (string | Buffer)[] = [];
  let tickets = 0;
  await page.route("http://127.0.0.1:8080/shell/ticket", (route) => {
    tickets++;
    expect(route.request().method()).toBe("POST");
    return route.fulfill({ json: { ticket: "test-ticket" } });
  });
  await page.routeWebSocket("ws://127.0.0.1:8080/shell?ticket=test-ticket", (ws) => {
    ws.send(Buffer.from("Connected to test robot\r\n$ "));
    ws.onMessage((message) => {
      messages.push(message);
      if (Buffer.isBuffer(message)) ws.send(message);
    });
  });
  await page.goto("/console");
  await connectDev(page);
  await expect(page.locator(".xterm-rows")).toContainText("Connected to test robot");
  await page.locator(".xterm-helper-textarea").focus();
  await page.keyboard.type("echo hello");
  await expect.poll(() => Buffer.concat(messages.filter(Buffer.isBuffer)).toString()).toBe("echo hello");
  const resizes = () =>
    messages
      .filter((m): m is string => typeof m === "string")
      .map((m) => JSON.parse(m) as { cols: number; rows: number });
  await expect.poll(() => resizes().length).toBeGreaterThan(0);
  const original = resizes().at(-1)!;
  const initialTickets = tickets;
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("terminal-connected.png") });
  await page.setViewportSize({ width: 1000, height: 700 });
  await expect.poll(() => resizes().at(-1)?.cols).toBeLessThan(original.cols);
  expect(resizes().at(-1)?.rows).toBeGreaterThan(10);
  expect(tickets).toBe(initialTickets);
});

const release = (id: number, name: string, tag: string) => ({
  id,
  name: `${name} ${tag}`,
  tag_name: tag,
  html_url: `https://github.com/KoalbyMQP/Core/releases/tag/${name}-${tag}`,
  created_at: "2026-09-20T00:00:00Z",
  published_at: id === 1 ? "2026-09-22T00:00:00Z" : "2026-09-20T00:00:00Z",
  draft: false,
  prerelease: tag.includes("alpha"),
  body: null,
});

test("App Store lists versions and installed images; launched apps update the sidebar", async ({ page }, testInfo) => {
  await page.route("https://api.github.com/repos/KoalbyMQP/Core/releases?*", (route) =>
    route.fulfill({
      json: [release(1, "Face", "v2.0.0-alpha"), release(2, "Face", "v1.0.0"), release(3, "Navigation", "v1.0.0")],
    })
  );
  await page.route("http://127.0.0.1:8080/images", (route) =>
    route.fulfill({
      json: {
        images: [
          { repository: "docker.io/koalbymqp/face", tags: ["v1.0.0", "v2.0.0-alpha"], id: "image-1" },
          { repository: "local/motor-tester", tags: ["latest"], id: "image-2" },
        ],
      },
    })
  );
  const launches: Record<string, string>[] = [];
  let instances: Record<string, string>[] = [];
  await page.route("http://127.0.0.1:8080/instances", (route) => {
    if (route.request().method() === "POST") {
      const app = route.request().postDataJSON();
      launches.push(app);
      const instance = { id: `instance-${launches.length}`, app: app.app, version: app.version, state: "running" };
      instances.push(instance);
      return route.fulfill({ status: 201, json: instance });
    }
    return route.fulfill({ json: { instances } });
  });
  await page.route("http://127.0.0.1:8080/instances/*", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1);
    instances = instances.filter((i) => i.id !== id);
    return route.fulfill({ json: { state: "stopped" } });
  });
  await page.goto("/apps");
  await connectDev(page);
  const online = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: "Online apps", exact: true }) });
  const installed = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: "Installed apps", exact: true }) });
  await expect(online.getByRole("listitem")).toHaveCount(2);
  await expect(installed.getByRole("listitem")).toHaveCount(2);
  await expect(online.getByText("Not installed", { exact: true })).toHaveCount(1);
  await expect(online.getByText("Installed", { exact: true })).toHaveCount(1);
  const left = await online.boundingBox();
  const right = await installed.boundingBox();
  expect(right!.x).toBeGreaterThan(left!.x + left!.width);
  await online.getByRole("button", { name: "Run Face", exact: true }).click();
  await expect(page.getByRole("menuitem")).toHaveCount(2);
  await expect(page.getByRole("menu")).toHaveCSS("opacity", "1");
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("app-store.png") });
  await page.getByRole("menuitem", { name: "v1.0.0", exact: true }).click();
  await expect.poll(() => launches.length).toBe(1);
  expect(launches[0]).toEqual({ app: "face", version: "v1.0.0" });
  await expect(page.getByRole("heading", { name: "Running apps", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Stop", exact: true })).toHaveCount(0);
  await installed.getByRole("button", { name: "Run motor-tester", exact: true }).click();
  await page.getByRole("menuitem", { name: "latest", exact: true }).click();
  await expect.poll(() => launches.length).toBe(2);
  expect(launches[1]).toEqual({ app: "motor-tester", version: "latest", image: "local/motor-tester:latest" });
  await page.getByRole("link", { name: "Dashboards", exact: true }).click();
  await expect(page.getByText("Dashboards aren't implemented yet.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Apps", exact: true }).getByRole("button", { name: "Face: running" })
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Apps", exact: true }).getByRole("button", { name: "Motor Tester: running" })
  ).toBeVisible();
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("dashboard.png") });
});

test("remote robots show installed apps and failed launches remain retryable", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "driver-station-connection",
      JSON.stringify({ name: "Robot", ip: "robot.test:9090", token: "test-token" })
    )
  );
  await page.route("http://robot.test:9090/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/images")
      return route.fulfill({ json: { images: [{ repository: "local/face", tags: ["v1"], id: "image-1" }] } });
    if (url.pathname === "/instances" && route.request().method() === "POST")
      return route.fulfill({ status: 500, json: { error: "Container runtime unavailable" } });
    return route.fulfill({ json: { status: "ok", instances: [] } });
  });
  await page.goto("/apps");
  await page.getByRole("button", { name: "Run face", exact: true }).click();
  await page.getByRole("menuitem", { name: "v1", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Container runtime unavailable" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run face", exact: true })).toBeEnabled();
});

test("sidebar app links select the right log stream and severity filters work", async ({ page }) => {
  await page.route("http://127.0.0.1:8080/images", (route) =>
    route.fulfill({
      json: {
        images: [
          { repository: "local/face", tags: ["v2"] },
          { repository: "local/motor-tester", tags: ["v1"] },
        ],
      },
    })
  );
  await page.addInitScript(() =>
    localStorage.setItem(
      "driver-station-connection",
      JSON.stringify({ name: "Dev Mode", ip: "127.0.0.1", devMode: true })
    )
  );
  await page.route("http://127.0.0.1:8080/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route("http://127.0.0.1:8080/instances", (route) =>
    route.fulfill({
      json: {
        instances: [
          { id: "motor-instance", app: "motor-tester", version: "v1", state: "running" },
          { id: "face-instance", app: "face", version: "v2", state: "running" },
        ],
      },
    })
  );
  await page.route("http://127.0.0.1:8080/instances/*/logs?*", (route) => {
    const app = route.request().url().includes("face-instance") ? "Face" : "Motor Tester";
    const lines = [
      { seq: 1, stream: "stdout", content: `${app} is running` },
      { seq: 2, stream: "stderr", content: `${app} test error` },
    ];
    return route.fulfill({
      contentType: "text/event-stream",
      body: lines
        .map((line) => `event: log\ndata: ${JSON.stringify({ ts: "2026-09-29T12:00:00Z", ...line })}\n\n`)
        .join(""),
    });
  });
  await page.goto("/");
  const apps = page.getByRole("navigation", { name: "Apps", exact: true });
  await apps.getByRole("button", { name: "Face: running", exact: true }).click();
  await apps.getByRole("link", { name: "v2 · Logs", exact: true }).click();
  await expect(page.getByText("Face is running", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Error", exact: true }).click();
  await expect(page.getByText("Face is running", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Face test error", { exact: true }).first()).toBeVisible();
  await apps.getByRole("button", { name: "Motor Tester: running", exact: true }).click();
  await apps.getByRole("link", { name: "v1 · Logs", exact: true }).click();
  await expect(page.getByText("Motor Tester is running", { exact: true }).first()).toBeVisible();
});
