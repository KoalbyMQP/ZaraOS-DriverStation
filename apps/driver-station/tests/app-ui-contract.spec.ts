import { test, expect } from "@playwright/test";
import { assetUrl, descriptorSchema } from "../lib/app-ui/schema";
import { createAppServices } from "../lib/app-ui/services";

const descriptor = {
  schemaVersion: 1,
  sdkVersion: 1,
  appId: "test-app",
  appVersion: "1",
  federation: { name: "test_app_ui_1", entry: "./mf-manifest.json" },
  components: { counter: { title: "Counter", module: "./Counter" } },
  pages: { overview: { title: "Overview", module: "./Overview" } },
};

test("accepts pages and components independently and rejects invalid export contracts", () => {
  expect(descriptorSchema.parse(descriptor).components).toEqual(descriptor.components);
  expect(descriptorSchema.parse({ ...descriptor, components: undefined }).components).toEqual({});
  expect(descriptorSchema.parse({ ...descriptor, pages: undefined }).pages).toEqual({});
  expect(descriptorSchema.safeParse({ ...descriptor, sdkVersion: 2 }).success).toBe(false);
  expect(descriptorSchema.safeParse({ ...descriptor, schemaVersion: 2 }).success).toBe(false);
  for (const pages of [
    { overview: { title: "Overview", module: "https://example.com/module.js" } },
    { "invalid/id": { title: "Overview", module: "./Overview" } },
    { overview: { title: "", module: "./Overview" } },
  ]) {
    expect(descriptorSchema.safeParse({ ...descriptor, pages }).success).toBe(false);
  }
});

test("resolves relative assets and rejects executable or credential-bearing URLs", () => {
  expect(assetUrl("./mf-manifest.json", "https://example.com/ui/v1/zara-ui.json")).toBe(
    "https://example.com/ui/v1/mf-manifest.json"
  );
  for (const url of [
    "javascript:alert(1)",
    "data:text/javascript,test",
    "https://user:pass@example.com/ui",
    "file:///tmp/ui",
  ]) {
    expect(() => assetUrl(url, "https://example.com")).toThrow();
  }
});

test("App services reject instance escapes and cancel requests after unmount", async () => {
  const lifetime = new AbortController();
  const services = createAppServices({ name: "Test", ip: "127.0.0.1:8080" }, "test-1", lifetime.signal);
  for (const path of [
    "//other-host/status",
    "/../auth/sessions",
    "/%2e%2e/auth",
    "/..\t/auth",
    "/\\other-host/status",
    "https://example.com/",
  ]) {
    await expect(services.request(path)).rejects.toThrow("within the instance API");
  }
  lifetime.abort();
  await expect(services.request("/status")).rejects.toThrow();
});
