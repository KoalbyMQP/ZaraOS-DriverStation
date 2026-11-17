import { createHash, createHmac } from "node:crypto";
import { test, expect } from "@playwright/test";
import { mixedContentHint, robotBaseUrl, signedFetch } from "../lib/robot-api";

const connection = { name: "Test robot", ip: "robot.test:9090", token: "a1".repeat(32) };
const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

// Cortex's RequireAuth passes r.URL.Path (decoded, without query parameters)
// and the raw body to ValidateRequest. Use Node crypto as an independent verifier.
function expectCortexSignature(init: RequestInit | undefined, method: string, path: string, body = "") {
  const headers = new Headers(init?.headers);
  const timestamp = headers.get("X-Timestamp");
  expect(timestamp).toBeTruthy();
  expect(init?.method).toBe(method);
  expect(init?.body ?? "").toBe(body);
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const expected = createHmac("sha256", connection.token)
    .update(`${timestamp}\n${method}\n${path}\n${bodyHash}`)
    .digest("hex");
  expect(headers.get("X-Signature")).toBe(expected);
}

for (const { name, path, cortexPath } of [
  { name: "requests without a query", path: "/instances", cortexPath: "/instances" },
  {
    name: "initial log streams",
    path: "/instances/demo-1/logs?stream=true&tail=100",
    cortexPath: "/instances/demo-1/logs",
  },
  {
    name: "resumed log streams",
    path: "/instances/demo-1/logs?stream=true&tail=100&since=2026-10-09T12%3A00%3A00.000Z",
    cortexPath: "/instances/demo-1/logs",
  },
  {
    name: "encoded paths",
    path: "/instances/demo%20robot/api/caf%C3%A9?limit=10",
    cortexPath: "/instances/demo robot/api/café",
  },
]) {
  test(`Cortex accepts signatures for ${name}`, async () => {
    globalThis.fetch = async (input, init) => {
      expect(String(input)).toBe(`http://robot.test:9090${path}`);
      expectCortexSignature(init, "GET", cortexPath);
      return new Response(null, { status: 200 });
    };

    const response = await signedFetch(connection, "GET", path);
    expect(response.ok).toBe(true);
  });
}

test("signs the exact JSON body and preserves query parameters and cancellation", async () => {
  const body = JSON.stringify({ label: "Café robot", speed: 0.5 });
  const controller = new AbortController();
  globalThis.fetch = async (input, init) => {
    expect(String(input)).toBe("http://robot.test:9090/instances/demo-1/api/settings?mode=preview");
    expect(init?.signal).toBe(controller.signal);
    expectCortexSignature(init, "POST", "/instances/demo-1/api/settings", body);
    return new Response(null, { status: 200 });
  };

  await signedFetch(connection, "POST", "/instances/demo-1/api/settings?mode=preview", body, {
    signal: controller.signal,
  });
});

test("localhost log requests remain unsigned", async () => {
  globalThis.fetch = async (input, init) => {
    expect(String(input)).toBe("http://127.0.0.1:8080/instances/demo-1/logs?stream=true&tail=100");
    const headers = new Headers(init?.headers);
    expect(headers.has("X-Timestamp")).toBe(false);
    expect(headers.has("X-Signature")).toBe(false);
    return new Response(null, { status: 200 });
  };

  await signedFetch({ name: "Dev Mode", ip: "127.0.0.1" }, "GET", "/instances/demo-1/logs?stream=true&tail=100");
});

test.describe("robot addresses", () => {
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
  const servedOver = (protocol: string) =>
    Object.defineProperty(globalThis, "location", { value: { protocol }, configurable: true });

  test.afterEach(() => {
    if (originalLocation) Object.defineProperty(globalThis, "location", originalLocation);
    else delete (globalThis as { location?: unknown }).location;
  });

  test("bare addresses use Cortex's plain-HTTP port", () => {
    expect(robotBaseUrl({ ip: "10.0.0.5" })).toBe("http://10.0.0.5:8080");
    expect(robotBaseUrl({ ip: "robot.local:9000" })).toBe("http://robot.local:9000");
  });

  test("https:// addresses are accepted and keep their own port", () => {
    expect(robotBaseUrl({ ip: "https://robot.example" })).toBe("https://robot.example");
    expect(robotBaseUrl({ ip: "https://10.0.0.5:8443" })).toBe("https://10.0.0.5:8443");
  });

  test("other schemes and paths are rejected", () => {
    for (const ip of ["ftp://robot", "https://robot/api", "https://user:pass@robot", "ws://robot"]) {
      expect(() => robotBaseUrl({ ip })).toThrow("Enter a robot hostname");
    }
  });

  test("an HTTPS-served page still accepts plain-HTTP addresses, but hints at mixed content", () => {
    servedOver("https:");
    // Not refused up front: some browsers allow private IP addresses from HTTPS pages.
    expect(robotBaseUrl({ ip: "10.0.0.5" })).toBe("http://10.0.0.5:8080");
    expect(mixedContentHint("http://10.0.0.5:8080")).toContain("https://");
    expect(mixedContentHint("http://robot.local:8080/auth/pair/start")).toContain("https://");
    // No hint where mixed content can't be the cause.
    expect(mixedContentHint("https://10.0.0.5:8443")).toBeNull();
    expect(mixedContentHint("http://127.0.0.1:8080")).toBeNull();
    expect(mixedContentHint("http://localhost:8080")).toBeNull();
  });

  test("an HTTP-served page can use either, with no hint", () => {
    servedOver("http:");
    expect(robotBaseUrl({ ip: "10.0.0.5" })).toBe("http://10.0.0.5:8080");
    expect(robotBaseUrl({ ip: "https://10.0.0.5:8443" })).toBe("https://10.0.0.5:8443");
    expect(mixedContentHint("http://10.0.0.5:8080")).toBeNull();
  });
});
