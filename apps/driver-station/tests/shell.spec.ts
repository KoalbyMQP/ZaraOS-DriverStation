import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 1024 } });

test.beforeEach(async ({ page }) => {
  await page.route("https://login.microsoftonline.com/**", (route) => route.abort());
  await page.route("https://api.github.com/**", (route) => route.fulfill({ json: [] }));
  await page.addInitScript(() => {
    const tenantId = "22222222-2222-2222-2222-222222222222";
    const account = {
      homeAccountId: `test-user.${tenantId}`,
      environment: "login.microsoftonline.com",
      realm: tenantId,
      localAccountId: "test-user",
      username: "test@example.com",
      name: "Test User",
      authorityType: "MSSTS",
      lastUpdatedAt: Date.now().toString(),
    };
    const key = `msal.3|${account.homeAccountId}|${account.environment}|${tenantId}`;
    sessionStorage.setItem(key, JSON.stringify(account));
    sessionStorage.setItem("msal.3.account.keys", JSON.stringify([key]));
    localStorage.setItem("driver-station-theme", "dark");
  });
});

test("shell keeps the old pages, pairing dialog, and account menu", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/console");
  await expect(page.getByRole("tab", { name: "Terminal", exact: true })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(1);
  await expect(page.getByRole("list", { name: "Robot metrics" }).getByText("???")).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Dark mode (unavailable)" })).toBeDisabled();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("link", { name: "Documentation" })).toHaveAttribute("href", "https://example.com");
  for (const link of await page.getByRole("link", { name: "Settings", exact: true }).all()) {
    await expect(link).toHaveAttribute("href", "https://example.com");
  }
  await expect(page.getByRole("img", { name: "Android" })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("shell-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("link", { name: "Terminals", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: testInfo.outputPath("shell-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1024 });

  await page.getByRole("button", { name: "Connect to robot: no robot connected" }).click();
  const dialog = page.getByRole("dialog", { name: "Connect to robot" });
  await expect(dialog.getByRole("button", { name: "Find IP with Bluetooth" })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).not.toBeVisible();

  await page.getByRole("link", { name: "Dashboards", exact: true }).click();
  await expect(page.getByRole("heading", { name: "User guide" })).toBeVisible();
  await page.getByRole("link", { name: "App Store", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Active", exact: true })).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(1);
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByText("Test User", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("terminal exchanges real protocol messages and resizes with the content area", async ({ page }, testInfo) => {
  const messages: (string | Buffer)[] = [];
  let ticketRequests = 0;
  await page.route("http://127.0.0.1:8080/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route("http://127.0.0.1:8080/shell/ticket", (route) => {
    ticketRequests++;
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
  await page.getByRole("button", { name: "Dev Mode", exact: true }).click();
  await expect(page.locator(".xterm-rows")).toContainText("Connected to test robot");
  await page.locator(".xterm-helper-textarea").focus();
  await page.keyboard.type("echo hello");
  await expect.poll(() => Buffer.concat(messages.filter(Buffer.isBuffer)).toString()).toBe("echo hello");
  await expect(page.locator(".xterm-rows")).toContainText("echo hello");

  const resizes = () =>
    messages
      .filter((message): message is string => typeof message === "string")
      .map((message) => JSON.parse(message) as { type: string; cols: number; rows: number });
  await expect.poll(() => resizes().length).toBeGreaterThan(0);
  const original = resizes().at(-1)!;
  const initialTicketRequests = ticketRequests;
  await page.screenshot({ path: testInfo.outputPath("terminal-connected.png") });
  await page.setViewportSize({ width: 1000, height: 700 });
  await expect.poll(() => resizes().at(-1)?.cols).toBeLessThan(original.cols);
  expect(resizes().at(-1)?.rows).toBeGreaterThan(10);
  expect(ticketRequests).toBe(initialTicketRequests);

  await page.getByRole("button", { name: "Connect to robot: Dev Mode" }).click();
  await expect(page.getByRole("dialog", { name: "Connect to robot" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(page.locator(".xterm")).toHaveCount(0);
  await expect(page.getByText("No robot connected. Use the Connect button in the header.")).toBeVisible();
});

test("sidebar opens the selected app's existing log viewer", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "driver-station-connection",
      JSON.stringify({ name: "Koalby 3", ip: "127.0.0.1", devMode: true })
    );
    localStorage.setItem(
      "driver-station-active-projects",
      JSON.stringify([
        { name: "Motor Tester", version: "v1", url: "local:motor:v1" },
        { name: "Face", version: "v2", url: "local:face:v2" },
      ])
    );
  });
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
    return route.fulfill({
      contentType: "text/event-stream",
      body: `event: log\ndata: ${JSON.stringify({ ts: "2026-09-29T12:00:00Z", seq: 1, stream: "stdout", content: `${app} is running` })}\n\n`,
    });
  });
  await page.goto("/");
  const apps = page.getByRole("navigation", { name: "Running apps" });
  await expect(apps.getByText("OK", { exact: true })).toHaveCount(2);
  await apps.getByRole("link", { name: "OK Face" }).click();
  await expect(page.getByText("Face is running", { exact: true })).toBeVisible();
  await apps.getByRole("link", { name: "OK Motor Tester" }).click();
  await expect(page.getByText("Motor Tester is running", { exact: true })).toBeVisible();
});
