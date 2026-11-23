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

const instance = (id: string, app: string, image: string, state = "running") => ({
  id,
  app,
  version: "v0.1.0",
  image: `${image}:v0.1.0`,
  state,
  error: null,
  started_at: "2026-11-23T10:00:00Z",
  stopped_at: null,
});
const JOINT_MOVER = instance("jm-1", "joint_mover_demo", "ghcr.io/koalbymqp/joint-mover-demo");
const OTHER_APPS = [
  instance("hello-1", "hello-ui", "ghcr.io/koalbymqp/hello-ui"),
  instance("jm-old", "joint_mover_demo", "ghcr.io/koalbymqp/joint-mover-demo", "stopped"),
];

type MoveCall = { instance: string; joint_name: string; position: number };
type Reply = { status: number; json?: unknown; body?: string };

/** Cortex's reply to `POST /instances/{id}/command` (ZaraOS spike/app-interactivity-system). */
const appReply = (id: string, status: number, reply: { ok: boolean; result?: unknown; error?: string | null }) => ({
  status,
  json: {
    instance: id,
    command: "move_joint",
    transport: "http",
    forward_us: 850,
    reply: { result: null, error: null, handler_us: 40, ...reply },
  },
});
const accepted = (call: MoveCall) =>
  appReply(call.instance, 200, { ok: true, result: { joint: call.joint_name, target: call.position } });

/**
 * A connected robot whose instance list is `instances`, answering move_joint commands with
 * `respond`. Every command request is checked against the real request shape and recorded.
 */
async function robotWithApps(
  page: Page,
  instances: object[],
  respond: (call: MoveCall) => Reply | Promise<Reply> = accepted
) {
  const robotRequests = await connectRobot(page);
  const calls: MoveCall[] = [];
  await page.route("http://127.0.0.1:8080/instances", (route) => route.fulfill({ json: { instances } }));
  await page.route("http://127.0.0.1:8080/instances/*/command", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    const body = request.postDataJSON() as { command: string; args: { joint_name: string; position: number } };
    expect(Object.keys(body).sort()).toEqual(["args", "command"]);
    expect(body.command).toBe("move_joint");
    expect(Object.keys(body.args).sort()).toEqual(["joint_name", "position"]);
    expect(typeof body.args.position).toBe("number");
    const call = { instance: new URL(request.url()).pathname.split("/")[2]!, ...body.args };
    calls.push(call);
    const reply = await respond(call);
    await route.fulfill(
      reply.json === undefined
        ? { status: reply.status, contentType: "text/plain; charset=utf-8", body: reply.body ?? "" }
        : { status: reply.status, json: reply.json }
    );
  });
  return { calls, robotRequests };
}

async function setJoints(page: Page, motor1: string, motor2: string) {
  // The manual move panel's field comes first, then Motor 1's and Motor 2's.
  await page.getByLabel("Joint name").nth(1).fill(motor1);
  await page.getByLabel("Joint name").nth(2).fill(motor2);
}

const lastSent = (page: Page) => page.getByLabel("Last sent", { exact: true });
const shot = async (page: Page, path: string, scrollTo: "top" | "bottom" = "top") => {
  await page
    .locator("#page-content")
    .evaluate((element, to) => element.scrollTo(0, to === "top" ? 0 : element.scrollHeight), scrollTo);
  await page.screenshot({ path, fullPage: true });
};

test("maps both sticks to both motors, arms only from centre, and never contacts the robot", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const robotRequests = await connectRobot(page);
  await mockGamepads(page);
  await page.goto("/gamepad-motors");

  await expect(page.getByRole("heading", { name: "Gamepad motors", exact: true })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("Joint mover app not running — moves are not sent");
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
  await expect(page.getByRole("note")).toContainText("No robot connected — moves are not sent");
  await expect(page.getByRole("button", { name: "Move", exact: true })).toBeDisabled();
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

test("manual move sends one move_joint to the running joint mover and shows the reply or the error", async ({
  page,
}, testInfo) => {
  let next: Reply | null = null;
  const { calls } = await robotWithApps(page, [...OTHER_APPS, JOINT_MOVER], (call) => next ?? accepted(call));
  await mockGamepads(page);
  await page.goto("/gamepad-motors");

  // Only the running joint mover is offered, and it is picked by default.
  await expect(page.getByText("joint_mover_demo · v0.1.0 · jm-1")).toBeVisible();
  await expect(page.getByText(/hello-ui|jm-old/)).toHaveCount(0);
  await expect(page.getByRole("note")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Gamepad motors", exact: true }).getByText("Connected", { exact: true })
  ).toBeVisible();

  const move = page.getByRole("button", { name: "Move", exact: true });
  await expect(move).toBeDisabled();
  await page.getByLabel("Joint name").first().fill("Shoulder");
  await page.getByLabel("Position", { exact: true }).fill("");
  await expect(page.getByText("Enter a position in degrees.")).toBeVisible();
  await expect(move).toBeDisabled();
  await page.getByLabel("Position", { exact: true }).fill("12.5");
  await move.click();
  await expect(page.getByRole("status", { name: "Manual move result" })).toHaveText(
    'Sent Shoulder to 12.5°. The app replied {"joint":"Shoulder","target":12.5}.'
  );
  expect(calls).toEqual([{ instance: "jm-1", joint_name: "Shoulder", position: 12.5 }]);
  await shot(page, testInfo.outputPath("manual-move-sent.png"));

  // The app's own error comes through Cortex's wrapper.
  next = appReply("jm-1", 400, { ok: false, error: "bad args: missing a required argument: 'position'" });
  await move.click();
  await expect(page.getByRole("alert").filter({ hasText: "Move failed" })).toContainText(
    "Shoulder to 12.5°: bad args: missing a required argument: 'position' (HTTP 400)"
  );

  // A Cortex without the command route answers with Go's plain-text 404.
  next = { status: 404, body: "404 page not found\n" };
  await move.click();
  await expect(page.getByRole("alert").filter({ hasText: "Move failed" })).toContainText(
    "This robot's Cortex doesn't support app commands yet."
  );
  // So does develop's Cortex, whose catch-all route answers in JSON.
  next = { status: 404, json: { error: "not found" } };
  await move.click();
  await expect(page.getByRole("alert").filter({ hasText: "Move failed" })).toContainText(
    "This robot's Cortex doesn't support app commands yet."
  );
  await page.getByLabel("Position", { exact: true }).fill("10");
  // Any other JSON 404 is Cortex or the app explaining itself, not a missing route.
  next = { status: 404, json: { error: "instance not found" } };
  await move.click();
  await expect(page.getByRole("alert").filter({ hasText: "Move failed" })).toContainText(
    "Shoulder to 10.0°: instance not found (HTTP 404)"
  );
  expect(calls).toHaveLength(5);

  // Manual moves are off while the gamepad drives the joints.
  next = null;
  await setJoints(page, "Shoulder", "Hip");
  await page.getByRole("button", { name: "Arm", exact: true }).click();
  await expect(page.getByText("Armed", { exact: true })).toBeVisible();
  await expect(move).toBeDisabled();
  await expect(page.getByText("Disarm the gamepad to move a joint by hand.")).toBeVisible();
});

test("gamepad sends move_joint per joint, only for changed targets, never queued or while disarmed", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let hold: Promise<void> | null = null;
  const { calls } = await robotWithApps(page, [JOINT_MOVER], async (call) => {
    if (hold && call.joint_name === "Shoulder") await hold;
    return accepted(call);
  });
  await mockGamepads(page);
  await page.goto("/gamepad-motors");
  await setPad(page, { axes: [0, 0, 0, 0] });
  await expect(page.getByText("joint_mover_demo · v0.1.0 · jm-1")).toBeVisible();

  // Joint names are required once connected, and must differ.
  const armButton = page.getByRole("button", { name: "Arm", exact: true });
  await expect(page.getByText("Enter the joint this motor drives.")).toHaveCount(2);
  await expect(armButton).toBeDisabled();
  await setJoints(page, "Shoulder", "Shoulder");
  await expect(page.getByText("Motor 1 already drives this joint.")).toBeVisible();
  await expect(armButton).toBeDisabled();
  await setJoints(page, "Shoulder", "Hip");

  // Nothing is sent while disarmed, whatever the sticks do.
  await setPad(page, { axes: [0, -1, 0, 1] });
  await page.waitForTimeout(200);
  expect(calls).toEqual([]);
  await setPad(page, { axes: [0, 0, 0, 0] });

  // Arming sends both current targets, one call per joint.
  await press(page, [0, 0, 0, 0], "a");
  await expect(page.getByText("Armed", { exact: true })).toBeVisible();
  await expect.poll(() => calls.length).toBe(2);
  expect(calls).toEqual(
    expect.arrayContaining([
      { instance: "jm-1", joint_name: "Shoulder", position: 0 },
      { instance: "jm-1", joint_name: "Hip", position: 0 },
    ])
  );
  await expect(page.getByLabel("Joint name").nth(1)).toBeDisabled();

  // Moving only the left stick moves only Shoulder.
  await setPad(page, { axes: [0, -1, 0, 0] });
  await expect.poll(() => calls.length).toBe(3);
  expect(calls[2]).toEqual({ instance: "jm-1", joint_name: "Shoulder", position: 45 });
  await setPad(page, { axes: [0, -1, 0, 0.5] });
  await expect.poll(() => calls.length).toBe(4);
  expect(calls[3]).toEqual({ instance: "jm-1", joint_name: "Hip", position: -18.5 });
  await expect(lastSent(page)).toHaveText("45.0° · -18.5°");
  // Holding still sends nothing more.
  await page.waitForTimeout(300);
  expect(calls).toHaveLength(4);
  await shot(page, testInfo.outputPath("gamepad-armed-top.png"));
  await shot(page, testInfo.outputPath("gamepad-armed-motors.png"), "bottom");

  // While Shoulder's move is in flight, its newer targets wait; only the latest goes out after.
  let release = () => {};
  hold = new Promise((resolve) => (release = resolve));
  await setPad(page, { axes: [0, -0.5, 0, 0.5] });
  await expect.poll(() => calls.length).toBe(5);
  expect(calls[4]).toEqual({ instance: "jm-1", joint_name: "Shoulder", position: 18.5 });
  await setPad(page, { axes: [0, -0.7, 0, 0.5] });
  await page.waitForTimeout(150);
  await setPad(page, { axes: [0, 0, 0, 0.5] });
  await page.waitForTimeout(150);
  expect(calls).toHaveLength(5);
  hold = null;
  release();
  await expect.poll(() => calls.length).toBe(6);
  expect(calls[5]).toEqual({ instance: "jm-1", joint_name: "Shoulder", position: 0 });
  await page.waitForTimeout(200);
  expect(calls).toHaveLength(6);

  // B disarms; nothing is sent afterwards.
  await press(page, [0, 0, 0, 0.5], "b");
  await expect(page.getByText("Disarmed", { exact: true })).toBeVisible();
  await setPad(page, { axes: [0, 1, 0, -1] });
  await page.waitForTimeout(300);
  expect(calls).toHaveLength(6);
  expect(errors).toEqual([]);
});

test("a failed move disarms and shows the error", async ({ page }, testInfo) => {
  let unsupported = false;
  const { calls } = await robotWithApps(page, [JOINT_MOVER], (call) =>
    unsupported
      ? { status: 404, body: "404 page not found\n" }
      : call.joint_name === "Hip" && call.position !== 0
        ? appReply("jm-1", 500, { ok: false, error: "ValueError: could not convert string to float: 'x'" })
        : accepted(call)
  );
  await mockGamepads(page);
  await page.goto("/gamepad-motors");
  await expect(page.getByText("joint_mover_demo · v0.1.0 · jm-1")).toBeVisible();
  await setPad(page, { axes: [0, 0, 0, 0] });
  await setJoints(page, "Shoulder", "Hip");
  await press(page, [0, 0, 0, 0], "a");
  await expect.poll(() => calls.length).toBe(2);

  await setPad(page, { axes: [0, 0, 0, -1] });
  const failure = page.getByRole("alert").filter({ hasText: "Sending failed — disarmed" });
  await expect(failure).toContainText("Hip to 45.0°: ValueError: could not convert string to float: 'x' (HTTP 500)");
  await expect(page.getByText("Disarmed", { exact: true })).toBeVisible();
  await setPad(page, { axes: [0, -1, 0, 1] });
  await page.waitForTimeout(300);
  expect(calls).toHaveLength(3);

  // Re-arming clears the error; a Cortex without the command route is named as such.
  unsupported = true;
  await setPad(page, { axes: [0, 0, 0, 0] });
  await press(page, [0, 0, 0, 0], "a");
  await expect(failure).toContainText("This robot's Cortex doesn't support app commands yet.");
  await expect(page.getByText("Disarmed", { exact: true })).toBeVisible();
  await shot(page, testInfo.outputPath("gamepad-error.png"));
});

test("without a running joint mover nothing is sent and the page says why", async ({ page }) => {
  const { calls, robotRequests } = await robotWithApps(page, OTHER_APPS);
  await mockGamepads(page);
  await page.goto("/gamepad-motors");
  await expect(page.getByRole("note")).toContainText("Joint mover app not running — moves are not sent");
  await expect(page.getByRole("note")).toContainText("Start joint_mover_demo from the App Store.");
  await expect(page.getByText("Joint mover instance")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Move", exact: true })).toBeDisabled();
  await expect(page.getByText("Connect to a running joint mover app to send moves.")).toBeVisible();

  // The local preview still arms without joint names, and sends nothing.
  await setPad(page, { axes: [0, 0, 0, 0] });
  await press(page, [0, 0, 0, 0], "a");
  await expect(page.getByText("Armed", { exact: true })).toBeVisible();
  await expect(lastSent(page)).toHaveText("0.0° · 0.0°");
  await setPad(page, { axes: [0, -1, 0, 1] });
  await expect(lastSent(page)).toHaveText("45.0° · -45.0°");
  expect(calls).toEqual([]);
  expect(robotRequests).toEqual([]);
});
