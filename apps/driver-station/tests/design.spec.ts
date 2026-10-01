import { test, expect } from "./ui-fixture";

test.use({ viewport: { width: 1440, height: 1024 } });

test("Figma shell geometry, stable selection typography, installed status, and empty Dashboard", async ({
  page,
}, testInfo) => {
  await page.clock.install();
  await page.addInitScript(() =>
    localStorage.setItem(
      "driver-station-connection",
      JSON.stringify({ name: "Koalby 3", ip: "127.0.0.1", devMode: true })
    )
  );
  await page.route("http://127.0.0.1:8080/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route("http://127.0.0.1:8080/images", (route) =>
    route.fulfill({
      json: {
        images: [
          { repository: "local/motor-tester", tags: ["v1", "v2"] },
          { repository: "local/face", tags: ["v1"] },
          { repository: "local/walking", tags: ["latest"] },
        ],
      },
    })
  );
  let motorState = "running";
  await page.route("http://127.0.0.1:8080/instances", (route) =>
    route.fulfill({
      json: {
        instances: [
          { id: "motor-1", app: "motor-tester", version: "v2", state: motorState },
          { id: "face-1", app: "face", version: "v1", state: "error" },
        ],
      },
    })
  );
  await page.route("http://127.0.0.1:8080/shell/ticket", (route) => route.fulfill({ json: { ticket: "design" } }));
  await page.routeWebSocket("ws://127.0.0.1:8080/shell?ticket=design", (ws) =>
    ws.send(Buffer.from("[root@koalby-3:/]# \r\n"))
  );
  await page.goto("/console");
  const apps = page.getByRole("navigation", { name: "Apps", exact: true });
  await expect(apps.getByRole("button", { name: "Motor Tester: running" })).toBeVisible();
  await expect(apps.getByRole("button", { name: "Face: error" })).toContainText("Error");
  await expect(apps.getByRole("button", { name: "Walking: stopped" })).toContainText("Off");
  await apps.getByRole("button", { name: "Motor Tester: running" }).click();
  await expect(apps.locator('[data-slot="sidebar-menu-sub"]').first()).toHaveCSS("border-left-width", "1px");
  await expect(page.getByText("Running apps", { exact: true })).toHaveCount(0);

  const sidebar = page.locator('[data-slot="sidebar-container"]');
  const header = page.getByRole("banner");
  const divider = page.locator('[data-slot="sidebar-separator"]');
  const search = page.getByRole("textbox", { name: "Search navigation" });
  const shellBox = await sidebar.boundingBox();
  const headerBox = await header.boundingBox();
  const dividerBox = await divider.boundingBox();
  const searchBox = await search.locator("..").boundingBox();
  expect(shellBox!.width).toBe(257);
  expect(headerBox!.height).toBe(57);
  expect(dividerBox!.y + dividerBox!.height).toBe(headerBox!.y + headerBox!.height);
  expect(searchBox!.y).toBe(65);
  await expect(divider).toHaveCount(1);
  await expect(search.locator("..")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(search.locator("..").locator("kbd")).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(search).toBeFocused();
  await search.fill("walking");
  await expect(apps.getByRole("button")).toHaveCount(1);
  await search.fill("");

  const robot = page.getByRole("button", { name: "Connect to robot: Koalby 3" });
  const centers = await robot.evaluate((el) =>
    [el.querySelector("img"), el.querySelector("span")].map((child) => {
      const box = child!.getBoundingClientRect();
      return box.y + box.height / 2;
    })
  );
  expect(Math.abs(centers[0] - centers[1])).toBeLessThan(1);
  const logo = page.getByRole("link", { name: "Driver Station", exact: true }).locator("img");
  await expect
    .poll(() => logo.evaluate((el: HTMLImageElement) => [el.naturalWidth, el.naturalHeight, el.width, el.height]))
    .toEqual([41, 24, 41, 24]);
  const terminalTab = page.getByRole("tab", { name: "Terminal", exact: true });
  const tabBox = await terminalTab.boundingBox();
  expect(tabBox!.x).toBe(headerBox!.x);
  expect(tabBox!.y).toBe(57);
  await expect(terminalTab).toHaveCSS("border-radius", "0px");
  expect(await terminalTab.evaluate((el) => getComputedStyle(el, "::after").top)).toBe("0px");
  expect(await terminalTab.evaluate((el) => getComputedStyle(el, "::after").backgroundColor)).toBe("rgb(22, 163, 74)");
  const nav = page.getByRole("navigation", { name: "Robot", exact: true });
  const terminals = nav.getByRole("link", { name: "Terminals", exact: true });
  const readType = () =>
    terminals.evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.fontSize, s.fontWeight, s.fontFamily];
    });
  const selectedType = await readType();
  expect(selectedType[0]).toBe("14px");
  expect(selectedType[1]).toBe("400");
  expect(selectedType[2]).toContain("Inter");
  await apps.getByRole("button", { name: "Motor Tester: running" }).click();
  await expect(apps.getByRole("link", { name: "v2 · Logs" })).toBeVisible();
  await terminalTab.focus();
  await page.keyboard.press("Tab");
  expect((await page.getByRole("button", { name: "New session" }).boundingBox())!.height).toBe(tabBox!.height);
  await expect(page.locator(".xterm-rows")).toContainText("root@koalby");
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("figma-terminal.png") });
  await nav.getByRole("link", { name: "Dashboards", exact: true }).click();
  expect(await readType()).toEqual(selectedType);
  const content = page.locator("#page-content");
  await expect(content.locator('[data-slot="empty"]')).toContainText("Dashboards aren't implemented yet.");
  await expect(content.getByRole("link")).toHaveCount(0);
  await expect(content.getByRole("button")).toHaveCount(0);
  await expect(page.locator('[data-slot="sidebar-inset"]')).toHaveCSS("background-color", "rgb(245, 245, 245)");
  await expect(header).toHaveCSS("background-color", "rgb(245, 245, 245)");
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("figma-dashboard.png") });
  motorState = "stopped";
  await page.clock.fastForward(15000);
  await expect(apps.getByRole("button", { name: "Motor Tester: stopped" })).toContainText("Off");
  await expect(apps.getByRole("button")).toHaveCount(3);
  await page.getByRole("button", { name: "Connect to robot: Koalby 3" }).click();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(apps.getByRole("button")).toHaveCount(0);
});

test("terminal tabs create separate sessions and retain them when switching", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("driver-station-connection", JSON.stringify({ name: "Local", ip: "127.0.0.1", devMode: true }))
  );
  await page.route("http://127.0.0.1:8080/health", (route) => route.fulfill({ json: { status: "ok" } }));
  let tickets = 0;
  await page.route("http://127.0.0.1:8080/shell/ticket", (route) =>
    route.fulfill({ json: { ticket: `session-${++tickets}` } })
  );
  let sockets = 0;
  await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:8080\/shell\?ticket=session-\d/, (ws) => {
    ws.send(Buffer.from(`Connected session-${++sockets}\r\n`));
  });
  await page.goto("/console");
  await expect(page.locator(".xterm-rows")).toContainText("session-1");
  await page.getByRole("button", { name: "New session" }).click();
  await expect(page.getByRole("tab", { name: "Terminal 2", exact: true })).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: "Terminal 2", exact: true })).toContainText("session-2");
  const ticketsBeforeSwitch = tickets;
  await page.getByRole("tab", { name: "Terminal", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Terminal", exact: true })).toContainText("session-1");
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  expect(sockets).toBe(2);
  expect(tickets).toBe(ticketsBeforeSwitch);
});
