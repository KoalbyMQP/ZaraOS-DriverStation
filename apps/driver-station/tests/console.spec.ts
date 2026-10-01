import { test, expect } from "./ui-fixture";

test("unreachable robots show an error and keep the form usable", async ({ page }) => {
  await page.route("http://robot.test:8080/**", (route) => route.abort());
  await page.goto("/console");
  await page.getByRole("button", { name: "Connect to robot: no robot connected" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("IP address", { exact: true }).fill("robot.test");
  await dialog.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Connect", exact: true })).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "Dev Mode", exact: true })).toBeEnabled();
});

test("invalid pairing codes can be retried or replaced with a new pairing request", async ({ page }) => {
  let starts = 0;
  await page.route("http://robot.test:8080/auth/pair/start", (route) => {
    starts++;
    return route.fulfill({ json: { expires_in: 120 } });
  });
  await page.route("http://robot.test:8080/auth/pair/complete", (route) =>
    route.fulfill({ status: 401, json: { error: "Invalid or expired code." } })
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Connect to robot: no robot connected" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("IP address", { exact: true }).fill("robot.test");
  await dialog.getByRole("button", { name: "Connect", exact: true }).click();
  await dialog.getByLabel("Pairing code", { exact: true }).fill("111111");
  await dialog.getByRole("button", { name: "Pair", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Invalid or expired code.");
  await dialog.getByRole("button", { name: "Back", exact: true }).click();
  await dialog.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(dialog.getByLabel("Pairing code", { exact: true })).toHaveValue("");
  expect(starts).toBe(2);
});

test("closing an in-flight Dev Mode check prevents a late connection", async ({ page }) => {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.route("http://127.0.0.1:8080/health", async (route) => {
    requested = true;
    await pending;
    await route.fulfill({ json: { status: "ok" } }).catch(() => {});
  });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Connect to robot: no robot connected" });
  await trigger.click();
  await page.getByRole("dialog").getByRole("button", { name: "Dev Mode", exact: true }).click();
  await expect.poll(() => requested).toBe(true);
  await page.keyboard.press("Escape");
  release();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem("driver-station-connection"))).toBeNull();
});

test("version menus include paginated GitHub releases", async ({ page }) => {
  const url = "https://api.github.com/repos/KoalbyMQP/Core/releases?per_page=100&page=2";
  await page.route("https://api.github.com/repos/KoalbyMQP/Core/releases?*", (route) => {
    const older = route.request().url().includes("page=2");
    const version = older ? "v1.0.0" : "v2.0.0";
    return route.fulfill({
      headers: older ? {} : { Link: `<${url}>; rel="next"`, "Access-Control-Expose-Headers": "Link" },
      json: [
        {
          id: older ? 2 : 1,
          name: `Face ${version}`,
          tag_name: version,
          html_url: `https://github.com/KoalbyMQP/Core/releases/tag/${version}`,
          published_at: "2026-09-30T00:00:00Z",
          created_at: "2026-09-30T00:00:00Z",
          draft: false,
          prerelease: false,
        },
      ],
    });
  });
  await page.goto("/apps");
  const online = page.locator('[data-slot="card"]').filter({ has: page.getByRole("heading", { name: "Online apps" }) });
  await expect(online.getByText("2 versions")).toBeVisible();
  await expect(online.getByRole("button", { name: "Run Face" })).toBeDisabled();
});
