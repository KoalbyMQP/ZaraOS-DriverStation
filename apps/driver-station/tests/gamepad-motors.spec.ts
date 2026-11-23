import type { Page } from "@playwright/test";
import { test, expect } from "./ui-fixture";

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

const XBOX = "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)";

type FakePad = { axes: number[]; a?: boolean; b?: boolean } | null;

declare global {
  interface Window {
    setFakePad: (pad: FakePad) => void;
  }
}

/** Replace the Gamepad API with one controller the test drives; the page polls it every frame. */
async function mockGamepads(page: Page) {
  await page.addInitScript((id) => {
    let current: Gamepad | null = null;
    window.setFakePad = (pad) => {
      current =
        pad &&
        ({
          id,
          index: 0,
          connected: true,
          mapping: "standard",
          timestamp: performance.now(),
          axes: pad.axes,
          buttons: Array.from({ length: 17 }, (_, i) => {
            const pressed = (i === 0 && !!pad.a) || (i === 1 && !!pad.b);
            return { pressed, touched: pressed, value: pressed ? 1 : 0 };
          }),
          vibrationActuator: null,
        } as unknown as Gamepad);
    };
    navigator.getGamepads = () => [current, null, null, null];
  }, XBOX);
}

/** Set the controller state and wait until the page has polled it. */
async function setPad(page: Page, pad: FakePad) {
  await page.evaluate((next) => {
    window.setFakePad(next);
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, pad);
}

async function press(page: Page, axes: number[], button: "a" | "b") {
  await setPad(page, { axes, [button]: true });
  await setPad(page, { axes });
}

async function connectRobot(page: Page) {
  const robotRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.origin === "http://127.0.0.1:8080" &&
      (request.method() !== "GET" || /\/(command|api)(\/|$)/.test(url.pathname))
    )
      robotRequests.push(`${request.method()} ${request.url()}`);
  });
  await page.route("http://127.0.0.1:8080/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.addInitScript(() =>
    localStorage.setItem(
      "driver-station-connection",
      JSON.stringify({ name: "Test robot", ip: "127.0.0.1:8080", devMode: true })
    )
  );
  return robotRequests;
}

const target = (page: Page, motor: 1 | 2) => page.getByLabel(`Motor ${motor} target`, { exact: true });

test("maps both sticks to both motors, arms only from centre, and never contacts the robot", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const robotRequests = await connectRobot(page);
  await mockGamepads(page);
  await page.goto("/gamepad-motors");

  await expect(page.getByRole("heading", { name: "Gamepad motors", exact: true })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("No backend yet — positions are not sent");
  const status = page.getByRole("status", { name: "Controller status" });
  await expect(status).toContainText("No controller");
  await expect(page.getByRole("slider")).toHaveCount(2);

  await setPad(page, { axes: [0, 0, 0, 0] });
  await expect(status).toContainText(XBOX);
  await expect(status).toContainText("Gamepad 0 · standard mapping");
  await expect(page.getByRole("slider")).toHaveCount(0);

  // Defaults: Y axis, up = positive, ±45°, deadzone 0.15 (rescaled so full deflection reaches the end).
  const deflected = [0.3, -1, 0, 0.5];
  await setPad(page, { axes: deflected });
  await expect(target(page, 1)).toHaveText("45.0°");
  await expect(target(page, 2)).toHaveText("-18.5°");
  const armButton = page.getByRole("button", { name: "Arm", exact: true });
  await expect(armButton).toBeDisabled();
  await expect(page.getByText("Centre both sticks to arm.")).toBeVisible();
  await press(page, deflected, "a");
  await expect(page.getByText("Disarmed", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Last sent", { exact: true })).toHaveText("—");
  await page.locator("#page-content").evaluate((element) => element.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("gamepad-motors-disarmed.png"), fullPage: true });

  // Inside the deadzone counts as centred. A arms; the current targets go out at once.
  await setPad(page, { axes: [0.1, 0.12, -0.1, 0] });
  await expect(target(page, 1)).toHaveText("0.0°");
  await press(page, [0.1, 0.12, -0.1, 0], "a");
  await expect(page.getByText("Armed", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Last sent", { exact: true })).toHaveText("0.0° · 0.0°");
  await expect(page.getByLabel("Minimum angle").first()).toBeDisabled();
  await expect(page.getByLabel("Deadzone")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Left / right" }).first()).toBeDisabled();
  await expect(page.getByRole("button", { name: "Down = +" }).first()).toBeDisabled();

  await setPad(page, { axes: deflected });
  await expect(page.getByLabel("Last sent", { exact: true })).toHaveText("45.0° · -18.5°");
  const sent = Number(await page.getByText("Updates sent").locator("+ dd").textContent());
  // Holding the sticks still sends nothing more.
  await page.waitForTimeout(300);
  await expect(page.getByText("Updates sent").locator("+ dd")).toHaveText(String(sent));
  await page.locator("#page-content").evaluate((element) => element.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("gamepad-motors-armed.png"), fullPage: true });
  await page.locator("#page-content").evaluate((element) => element.scrollTo(0, element.scrollHeight));
  await page.screenshot({ path: testInfo.outputPath("gamepad-motors-armed-motors.png"), fullPage: true });

  // B disarms; nothing is sent afterwards.
  await press(page, deflected, "b");
  await expect(page.getByText("Disarmed", { exact: true })).toBeVisible();
  await setPad(page, { axes: [0, -0.6, 0, -1] });
  await expect(target(page, 2)).toHaveText("45.0°");
  await expect(page.getByLabel("Last sent", { exact: true })).toHaveText("45.0° · -18.5°");

  await setPad(page, { axes: [0, 0, 0, 0] });
  // Losing window focus disarms.
  await armButton.click();
  await expect(page.getByText("Armed", { exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.getByText("Disarmed", { exact: true })).toBeVisible();

  // Disconnecting the controller disarms, and reconnecting does not re-arm.
  await armButton.click();
  await expect(page.getByText("Armed", { exact: true })).toBeVisible();
  await setPad(page, null);
  await expect(page.getByText("Disarmed", { exact: true })).toBeVisible();
  await expect(status).toContainText("No controller");
  await setPad(page, { axes: [0, 0, 0, 0] });
  await expect(status).toContainText(XBOX);
  await expect(page.getByText("Disarmed", { exact: true })).toBeVisible();

  expect(robotRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("falls back to keyboard sliders without a controller and validates the mapping", async ({ page }) => {
  await mockGamepads(page);
  await page.goto("/gamepad-motors");
  const slider = page.getByRole("slider", { name: "Motor 1 target (no controller)" });
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(target(page, 1)).toHaveText("1.0°");
  await page.getByRole("button", { name: "Arm", exact: true }).click();
  await expect(page.getByLabel("Last sent", { exact: true })).toHaveText("1.0° · 0.0°");
  await page.getByRole("button", { name: "Disarm", exact: true }).click();

  // Motor 2 on the X axis: right = positive by default, and the direction can be flipped.
  await page.getByRole("button", { name: "Left / right" }).nth(1).click();
  await expect(page.getByRole("button", { name: "Right = +" })).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => window.setFakePad({ axes: [0, 0, 1, 0] }));
  await expect(target(page, 2)).toHaveText("45.0°");
  await page.getByRole("button", { name: "Left = +" }).click();
  await expect(target(page, 2)).toHaveText("-45.0°");

  await page.getByLabel("Minimum angle").first().fill("90");
  const content = page.getByRole("region", { name: "Gamepad motors", exact: true });
  await expect(content.getByRole("alert")).toContainText("The minimum must be less than the maximum.");
  await expect(target(page, 1)).toHaveText("—");
  await page.evaluate(() => window.setFakePad({ axes: [0, 0, 0, 0] }));
  await expect(page.getByText("Fix the settings to arm.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Arm", exact: true })).toBeDisabled();
});

test("fits a phone screen without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/gamepad-motors");
  await expect(page.getByRole("heading", { name: "Gamepad motors", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  expect(await page.locator("#page-content").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true
  );
});
