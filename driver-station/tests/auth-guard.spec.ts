import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // These tests exercise session restoration and routing, without contacting Azure.
  await page.route("https://login.microsoftonline.com/**", (route) =>
    route.request().isNavigationRequest()
      ? route.fulfill({ contentType: "text/html", body: "<h1>Microsoft sign-in</h1>" })
      : route.abort(),
  );
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill({ json: [] }),
  );
});

test.describe("before hydration", () => {
  test.use({ javaScriptEnabled: false });

  for (const path of ["/", "/console", "/apps", "/logs"]) {
    test(`${path} serves a loading screen without app content`, async ({ page }) => {
      await page.goto(path);

      await expect(page.getByRole("status")).toHaveText("Loading...");
      await expect(page.getByRole("banner")).toHaveCount(0);
      await expect(page.locator("main")).toHaveCount(0);
    });
  }
});

test("signed-out users redirect before page or connection effects run", async ({ page }) => {
  const appRequests: string[] = [];
  const visitedPaths: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      visitedPaths.push(new URL(frame.url()).pathname);
    }
  });
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("api.github.com") || url.includes("127.0.0.1:8080")) {
      appRequests.push(url);
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem("driver-station-connection", JSON.stringify({
      name: "Stored robot",
      ip: "127.0.0.1",
      devMode: true,
    }));
  });

  await page.goto("/apps");

  await expect(page.getByRole("heading", { name: "Microsoft sign-in" })).toBeVisible();
  expect(visitedPaths).toContain("/authenticate");
  await expect(page.getByRole("banner")).toHaveCount(0);
  expect(appRequests).toEqual([]);
});

test("restores a cached account without redirecting and allows app navigation", async ({ page }) => {
  const hydrationErrors: string[] = [];
  const signInVisits: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat/i.test(message.text())) {
      hydrationErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => hydrationErrors.push(error.message));
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && new URL(frame.url()).pathname === "/authenticate") {
      signInVisits.push(frame.url());
    }
  });
  await page.addInitScript(() => {
    // MSAL Browser 5 account cache (schema 2), with no real credentials or tokens.
    const tenantId = "22222222-2222-2222-2222-222222222222";
    const account = {
      homeAccountId: `test-user.${tenantId}`,
      environment: "login.microsoftonline.com",
      realm: tenantId,
      localAccountId: "test-user",
      username: "test@example.com",
      name: "Test User",
      authorityType: "MSSTS",
      lastUpdatedAt: new Date().toISOString(),
    };
    const key = `msal.2|${account.homeAccountId}|${account.environment}|${tenantId}`;
    sessionStorage.setItem(key, JSON.stringify(account));
    sessionStorage.setItem("msal.2.account.keys", JSON.stringify([key]));
  });

  await page.goto("/console");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByText("No robot connected. Use the Connect button in the header.")).toBeVisible();

  await page.getByRole("link", { name: "Apps", exact: true }).click();
  await expect(page).toHaveURL("/apps");
  await expect(page.getByRole("banner")).toBeVisible();
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByText("Test User", { exact: true })).toBeVisible();
  expect(signInVisits).toEqual([]);
  expect(hydrationErrors).toEqual([]);
});
