import type { Connection } from "@/contexts/ConnectionContext";
import { signedFetch } from "@/lib/robot-api";
import type { AppCommand, AppControl, AppServices, JsonValue } from "./types";

// The names Cortex accepts for commands and controls. Checking here keeps anything else out of the
// signed URL path, so a name can never address another route.
const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const RECONNECT_MS = 2000;

type Json = Record<string, unknown>;

function assertName(kind: string, name: string) {
  if (!NAME.test(name)) throw new Error(`Invalid ${kind} name: ${JSON.stringify(name)}.`);
}

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });
}

/** Read a server-sent event stream to its end, calling `onEvent` for each event that carries data. */
async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (event: string, data: string) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      let event = "message";
      const data: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (data.length) onEvent(event, data.join("\n"));
    }
  }
}

export function createAppServices(connection: Connection, instanceId: string, lifetime: AbortSignal): AppServices {
  const base = `/instances/${encodeURIComponent(instanceId)}`;
  const within = (signal?: AbortSignal) => (signal ? AbortSignal.any([lifetime, signal]) : lifetime);

  // The App keeps one sequence per control across every viewer and page load, and drops any update
  // that is not newer. A counter starting at 1 would be ignored after a reload until it caught up,
  // so order updates by the clock instead, nudged forward so two in the same millisecond differ.
  let lastSeq = 0;
  const nextSeq = () => (lastSeq = Math.max(Date.now(), lastSeq + 1));

  /** Send a JSON request to the instance. Returns the response and its parsed body (`null` if not JSON). */
  async function call(method: string, path: string, body: Json | undefined, signal?: AbortSignal) {
    const scoped = within(signal);
    scoped.throwIfAborted();
    const response = await signedFetch(
      connection,
      method,
      base + path,
      body === undefined ? undefined : JSON.stringify(body),
      { signal: scoped }
    );
    const data: unknown = await response.json().catch(() => null);
    return { response, data: isObject(data) ? data : null };
  }

  function failure(what: string, response: Response, data: Json | null) {
    const message = typeof data?.error === "string" && data.error ? data.error : `${what} failed (${response.status}).`;
    return new Error(message);
  }

  /** Fetch a list Cortex returns under `key`. */
  async function list<T>(what: string, path: string, key: string, signal?: AbortSignal) {
    const { response, data } = await call("GET", path, undefined, signal);
    const items = data?.[key];
    if (!response.ok || !Array.isArray(items)) throw failure(what, response, data);
    return items as T[];
  }

  return {
    async command(name, args = {}, options = {}) {
      assertName("command", name);
      const { response, data } = await call("POST", "/command", { command: name, args }, options.signal);
      // Cortex wraps the App's reply; the App's own error is the useful one when there is one.
      const reply = isObject(data?.reply) ? data.reply : null;
      if (response.ok && reply?.ok === true) return reply.result;
      throw failure("App command", response, reply && typeof reply.error === "string" ? reply : data);
    },

    commands: (options = {}) => list<AppCommand>("Listing App commands", "/commands", "commands", options.signal),

    controls: (options = {}) => list<AppControl>("Listing App controls", "/controls", "controls", options.signal),

    async setControl(name, value, options = {}) {
      assertName("control", name);
      const { response, data } = await call(
        "PUT",
        `/controls/${name}`,
        { value, seq: options.seq ?? nextSeq() },
        options.signal
      );
      if (!response.ok || !data) throw failure("Setting an App control", response, data);
      return { accepted: data.accepted === true, stale: data.stale === true, value: data.value as JsonValue };
    },

    telemetry(onValues, options = {}) {
      const unsubscribe = new AbortController();
      const signal = AbortSignal.any([within(options.signal), unsubscribe.signal]);
      const query = options.maxHz ? `?max_hz=${encodeURIComponent(options.maxHz)}` : "";

      const deliver = (data: string) => {
        let values: unknown;
        try {
          values = (JSON.parse(data) as { values?: unknown }).values;
        } catch {
          return;
        }
        if (!isObject(values) || signal.aborted) return;
        try {
          onValues(values as Record<string, JsonValue>);
        } catch (error) {
          // A bug in the page's callback is the page's to see, but must not end the stream.
          queueMicrotask(() => {
            throw error;
          });
        }
      };

      void (async () => {
        while (!signal.aborted) {
          try {
            const response = await signedFetch(connection, "GET", `${base}/telemetry${query}`, undefined, { signal });
            if (response.ok && response.body) {
              await readEvents(response.body, (event, data) => {
                if (event === "snapshot" || event === "telemetry") deliver(data);
              });
            } else {
              const data: unknown = await response.json().catch(() => null);
              if (!signal.aborted)
                options.onError?.(failure("App telemetry", response, isObject(data) ? data : null).message);
              // The request or the App itself is the problem; asking again will not change the answer.
              if ([400, 404, 501].includes(response.status)) return;
            }
          } catch {
            // Aborted, or the connection dropped mid-stream: fall through and reconnect if still wanted.
          }
          await sleep(RECONNECT_MS, signal);
        }
      })();

      return () => unsubscribe.abort();
    },
  };
}
