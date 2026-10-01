import { test as base, expect } from "@playwright/test";

export { expect };

export const test = base.extend<{ authenticatedPage: void }>({
  authenticatedPage: [
    async ({ page }, use) => {
      await page.route("https://login.microsoftonline.com/**", (route) => route.abort());
      await page.route("https://api.github.com/**", (route) => route.fulfill({ json: [] }));
      await page.route("http://127.0.0.1:8080/instances", (route) => route.fulfill({ json: { instances: [] } }));
      await page.route("http://127.0.0.1:8080/images", (route) => route.fulfill({ json: { images: [] } }));
      await page.addInitScript(() => {
        const tenantId = "22222222-2222-2222-2222-222222222222";
        const account = {
          homeAccountId: `test-user.${tenantId}`,
          environment: "login.microsoftonline.com",
          realm: tenantId,
          localAccountId: "test-user",
          username: "test@example.com",
          tenantProfiles: [
            {
              tenantId,
              localAccountId: "test-user",
              username: "test@example.com",
              name: "Test User",
              isHomeTenant: true,
            },
          ],
          name: "Test User",
          authorityType: "MSSTS",
          lastUpdatedAt: Date.now().toString(),
        };
        const key = `msal.3|${account.homeAccountId}|${account.environment}|${tenantId}`;
        sessionStorage.setItem(key, JSON.stringify(account));
        sessionStorage.setItem("msal.3.account.keys", JSON.stringify([key]));
      });
      await use();
    },
    { auto: true },
  ],
});
