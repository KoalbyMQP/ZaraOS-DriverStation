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

const robot = { name: "Test", ip: "127.0.0.1:8080" };

/** Answer the services' requests in-process; returns every request they made. */
function stubRobot(
  respond: (request: { method: string; path: string; body: unknown }) => Response | Promise<Response>
) {
  const requests: { method: string; path: string; body: unknown }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const request = {
      method: init?.method ?? "GET",
      path: url.pathname + url.search,
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined,
    };
    requests.push(request);
    init?.signal?.throwIfAborted();
    return respond(request);
  }) as typeof fetch;
  return { requests, restore: () => void (globalThis.fetch = original) };
}

function eventStream(...frames: string[]) {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const frame of frames) controller.enqueue(new TextEncoder().encode(frame));
        controller.close();
      },
    }),
    { headers: { "Content-Type": "text/event-stream" } }
  );
}

test("App services reject names that could address another route and cancel requests after unmount", async () => {
  const lifetime = new AbortController();
  const services = createAppServices(robot, "test-1", lifetime.signal);
  const robotStub = stubRobot(() => Response.json({}));
  try {
    for (const name of [
      "../restart",
      "a/b",
      "",
      "_set_control",
      "speed?x=1",
      "speed#",
      " speed",
      "%2e%2e",
      "x".repeat(65),
    ]) {
      await expect(services.command(name)).rejects.toThrow("Invalid command name");
      await expect(services.setControl(name, 1)).rejects.toThrow("Invalid control name");
    }
    lifetime.abort();
    await expect(services.command("status")).rejects.toThrow();
    await expect(services.controls()).rejects.toThrow();
    expect(robotStub.requests).toEqual([]);
  } finally {
    robotStub.restore();
  }
});

test("App services speak the Cortex command and control contract for their own instance", async () => {
  const services = createAppServices(robot, "motor control/1", new AbortController().signal);
  const reply = (result: unknown) => ({ transport: "http", reply: { ok: true, result, error: null, handler_us: 3 } });
  const robotStub = stubRobot(({ method, path, body }) => {
    const command = (body as { command?: string } | undefined)?.command;
    if (path.endsWith("/command") && command === "move") return Response.json(reply({ moving: true }));
    if (path.endsWith("/command") && command === "explode")
      return Response.json({ reply: { ok: false, result: null, error: "ValueError: no" } }, { status: 500 });
    if (path.endsWith("/command"))
      return Response.json({ error: "could not reach instance command server" }, { status: 502 });
    if (path.endsWith("/commands"))
      return Response.json({ commands: [{ name: "move", doc: null, params: [{ name: "angle", required: true }] }] });
    if (method === "GET" && path.endsWith("/controls"))
      return Response.json({ error: "instance is stopped" }, { status: 409 });
    return Response.json({ control: "speed", accepted: false, stale: true, value: 40, forward_us: 9 });
  });
  try {
    expect(await services.command("move", { angle: 90 })).toEqual({ moving: true });
    await expect(services.command("explode")).rejects.toThrow("ValueError: no");
    await expect(services.command("unreachable")).rejects.toThrow("could not reach instance command server");
    expect(await services.commands()).toEqual([
      { name: "move", doc: null, params: [{ name: "angle", required: true }] },
    ]);
    await expect(services.controls()).rejects.toThrow("instance is stopped");
    expect(await services.setControl("speed", 55, { seq: 7 })).toEqual({ accepted: false, stale: true, value: 40 });
    expect(await services.setControl("speed", 60)).toMatchObject({ value: 40 });
    // Without an explicit seq, later updates must still outrank earlier ones, even within a millisecond.
    await services.setControl("speed", 61);
    const [first, second] = robotStub.requests.slice(-2).map((request) => (request.body as { seq: number }).seq);
    expect(second).toBeGreaterThan(first);
    expect(first).toBeGreaterThan(1_700_000_000_000);
    robotStub.requests.pop();

    const base = "/instances/motor%20control%2F1";
    expect(robotStub.requests).toEqual([
      { method: "POST", path: `${base}/command`, body: { command: "move", args: { angle: 90 } } },
      { method: "POST", path: `${base}/command`, body: { command: "explode", args: {} } },
      { method: "POST", path: `${base}/command`, body: { command: "unreachable", args: {} } },
      { method: "GET", path: `${base}/commands`, body: undefined },
      { method: "GET", path: `${base}/controls`, body: undefined },
      { method: "PUT", path: `${base}/controls/speed`, body: { value: 55, seq: 7 } },
      { method: "PUT", path: `${base}/controls/speed`, body: { value: 60, seq: expect.any(Number) } },
    ]);
  } finally {
    robotStub.restore();
  }
});

test("App telemetry delivers the snapshot and changes, reconnects, and stops when unsubscribed", async () => {
  const lifetime = new AbortController();
  const services = createAppServices(robot, "test-1", lifetime.signal);
  let opened = 0;
  const robotStub = stubRobot(() => {
    opened += 1;
    if (opened === 1)
      return eventStream(
        'event: snapshot\ndata: {"ts":1,"values":{"angle":10,"torque":true}}\n\n',
        ": keepalive\n\n",
        // A frame split across network chunks must still arrive whole.
        'event: telemetry\ndata: {"ts":2,"val',
        'ues":{"angle":12}}\n\nevent: error\ndata: {"message":"instance telemetry stream ended"}\n\n'
      );
    return eventStream(
      'event: snapshot\r\ndata: {"ts":3,"values":{"angle":15}}\r\n\r\n',
      "event: telemetry\ndata: not json\n\n"
    );
  });
  try {
    const received: unknown[] = [];
    const unsubscribe = services.telemetry((values) => received.push(values), { maxHz: 20 });
    await expect
      .poll(() => received, { timeout: 10_000 })
      .toEqual([{ angle: 10, torque: true }, { angle: 12 }, { angle: 15 }]);
    expect(robotStub.requests[0]).toEqual({
      method: "GET",
      path: "/instances/test-1/telemetry?max_hz=20",
      body: undefined,
    });

    unsubscribe();
    const afterUnsubscribe = opened;
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(opened).toBe(afterUnsubscribe);
  } finally {
    lifetime.abort();
    robotStub.restore();
  }
});

test("App telemetry reports an App without telemetry once instead of retrying forever", async () => {
  const services = createAppServices(robot, "test-1", new AbortController().signal);
  const robotStub = stubRobot(() =>
    Response.json({ error: "app does not support telemetry (SDK too old?)" }, { status: 404 })
  );
  try {
    const errors: string[] = [];
    services.telemetry(() => {}, { onError: (message) => errors.push(message) });
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(errors).toEqual(["app does not support telemetry (SDK too old?)"]);
    expect(robotStub.requests).toHaveLength(1);
  } finally {
    robotStub.restore();
  }
});
