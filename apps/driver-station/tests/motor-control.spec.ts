import { test, expect } from "./ui-fixture";

test("reviews a movement locally without sending commands, even with a connected robot", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const commands: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.origin === "http://127.0.0.1:8080" &&
      (request.method() !== "GET" || /\/(command|api)(\/|$)/.test(url.pathname))
    )
      commands.push(request.url());
  });
  await page.route("http://127.0.0.1:8080/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.addInitScript(() =>
    localStorage.setItem(
      "driver-station-connection",
      JSON.stringify({ name: "Test robot", ip: "127.0.0.1:8080", devMode: true })
    )
  );
  await page.goto("/");
  await page.getByRole("link", { name: "Motor control Preview", exact: true }).click();
  await expect(page).toHaveURL(/\/motor-control$/);
  await expect(page.getByRole("heading", { name: "Motor control", exact: true })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("motors will not move");

  await page.getByLabel("Joint name", { exact: true }).fill("Shoulder");
  await page.getByLabel("Target angle", { exact: true }).fill("-23.5");
  await page.getByLabel("Movement time", { exact: true }).fill("1500");
  await page.getByRole("button", { name: "Red", exact: true }).click();
  await page.getByRole("button", { name: "Review movement" }).click();
  await expect(page.getByRole("status")).toContainText("Movement reviewed for Shoulder. Nothing has been sent");
  await expect(page.locator("figcaption")).toContainText("-23.5°");
  await expect(page.getByText("1500 ms", { exact: true })).toBeVisible();
  for (const name of ["Send to motor", "Read angle", "Enable torque", "Disable torque"])
    await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
  await expect(page.getByText("Unknown", { exact: true })).toHaveCount(2);
  await page.locator("#page-content").evaluate((element) => element.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("motor-control-desktop.png"), fullPage: true });

  await page.getByLabel("Target angle", { exact: true }).fill("12");
  await expect(page.getByRole("status")).toContainText("Review your settings");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByLabel("Joint name", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Joint name", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Target angle", { exact: true })).toHaveValue("0");
  await expect(page.getByLabel("Movement time", { exact: true })).toHaveValue("1000");
  await expect(page.getByRole("button", { name: "Blue", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(commands).toEqual([]);
  expect(errors).toEqual([]);
});

test("validates joint, angle and duration before reviewing a draft", async ({ page }) => {
  await page.goto("/motor-control");
  const content = page.getByRole("region", { name: "Motor control", exact: true });
  await page.getByLabel("Joint name", { exact: true }).fill("   ");
  await page.getByLabel("Target angle", { exact: true }).fill("");
  await page.getByLabel("Movement time", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Review movement" }).click();
  await expect(page.getByLabel("Joint name", { exact: true })).toBeFocused();
  await expect(content.getByRole("alert")).toHaveCount(3);
  await expect(page.getByLabel("Target angle", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Joint name", { exact: true }).fill("  Hip  ");
  await page.getByLabel("Target angle", { exact: true }).fill("45");
  for (const value of ["-10", "1.5", "9007199254740992"]) {
    await page.getByLabel("Movement time", { exact: true }).fill(value);
    await page.getByRole("button", { name: "Review movement" }).click();
    await expect(content.getByRole("alert")).toContainText("whole number of milliseconds greater than zero");
    await expect(page.getByLabel("Movement time", { exact: true })).toBeFocused();
  }
  await page.getByLabel("Movement time", { exact: true }).fill("500");
  await page.getByRole("button", { name: "Review movement" }).click();
  await expect(content.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Movement reviewed for Hip.");
});

test("works without a robot on mobile and keeps the navigation searchable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await page.getByRole("textbox", { name: "Search navigation" }).fill("motor");
  await page.getByRole("link", { name: "Motor control Preview", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Sidebar" })).not.toBeVisible();
  await page.getByLabel("Joint name", { exact: true }).fill("Shoulder");
  await page.getByRole("button", { name: "Green", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Green", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Review movement" }).click();
  await expect(page.getByRole("status")).toContainText("Movement reviewed for Shoulder");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(await page.locator("#page-content").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true
  );
  await page.locator("#page-content").evaluate((element) => element.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("motor-control-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Read angle", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("motor-control-mobile-feedback.png"), fullPage: true });
});
