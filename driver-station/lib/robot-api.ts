/**
 * Signed requests to the robot API (Cortex). Protected endpoints require
 * X-Timestamp and X-Signature per RobotAPI:
 *   bodyHash = hex(SHA256(raw_request_body))
 *   message = timestamp + "\n" + METHOD + "\n" + path + "\n" + bodyHash
 *   signature = hex(HMAC-SHA256(key=token, message=message))
 */

import type { Connection } from "@/contexts/ConnectionContext";

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(data: string): Promise<string> {
  const bytes = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(hash);
}

async function hmacSha256Hex(keyUtf8: string, message: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(keyUtf8);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(message)
  );
  return toHex(sig);
}

async function signRequest(
  token: string,
  method: string,
  path: string,
  body: string
): Promise<{ timestamp: string; signature: string }> {
  const timestamp = new Date().toISOString();
  const bodyHash = await sha256Hex(body);
  const message = `${timestamp}\n${method}\n${path}\n${bodyHash}`;
  const signature = await hmacSha256Hex(token, message);
  return { timestamp, signature };
}

function baseUrl(connection: Connection): string {
  return `http://${connection.ip}:8080`;
}

/**
 * GET /health — public, no signing (RobotAPI.md).
 */
export async function checkRobotHealth(connection: Connection): Promise<boolean> {
  const res = await fetch(`${baseUrl(connection)}/health`, { method: "GET" });
  return res.ok;
}

/** Cortex allows unsigned requests when the client connects to localhost (see RobotAPI.md). */
export function isLocalRobotHost(connection: Connection): boolean {
  const ip = connection.ip.trim().toLowerCase();
  return ip === "127.0.0.1" || ip === "localhost" || ip === "::1";
}

/**
 * Perform a signed request to the robot API. Localhost connections use unsigned requests (no token).
 */
export async function signedFetch(
  connection: Connection,
  method: string,
  path: string,
  body?: string
): Promise<Response> {
  const b = body ?? "";
  if (isLocalRobotHost(connection)) {
    const url = `${baseUrl(connection)}${path}`;
    return fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(b ? { body: b } : {}),
    });
  }
  const token = connection.token;
  if (!token) {
    throw new Error("Connection has no token; cannot sign request");
  }
  const { timestamp, signature } = await signRequest(token, method, path, b);
  const url = `${baseUrl(connection)}${path}`;
  return fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    },
    ...(b ? { body: b } : {}),
  });
}

export type RobotSession = {
  token_prefix: string;
  label: string;
  created_at: string;
  last_seen: string;
};

export type SessionsResponse = {
  sessions: RobotSession[];
};

/**
 * GET /auth/sessions — list active sessions. Requires signing.
 */
export async function getSessions(
  connection: Connection
): Promise<SessionsResponse> {
  const res = await signedFetch(connection, "GET", "/auth/sessions");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string })?.error ?? `sessions failed: ${res.status}`
    );
  }
  return res.json() as Promise<SessionsResponse>;
}

export type RobotAppInstance = {
  id: string;
  app: string;
  version: string;
  state: string;
  started_at: string | null;
  stopped_at: string | null;
};

export type InstancesResponse = {
  instances: RobotAppInstance[];
};

export type LocalContainerImage = {
  repository: string;
  tags: string[];
  id: string;
  size: string;
  created_at: string;
};

export type ImagesResponse = {
  images: LocalContainerImage[];
};

/**
 * GET /images — list locally available container images (grouped by repository in the payload).
 */
export async function getImages(connection: Connection): Promise<ImagesResponse> {
  const res = await signedFetch(connection, "GET", "/images");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string })?.error ?? `images failed: ${res.status}`
    );
  }
  return res.json() as Promise<ImagesResponse>;
}

/**
 * GET /instances — list all instances (running and recently stopped).
 */
export async function getInstances(
  connection: Connection
): Promise<InstancesResponse> {
  const res = await signedFetch(connection, "GET", "/instances");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string })?.error ?? `instances failed: ${res.status}`
    );
  }
  return res.json() as Promise<InstancesResponse>;
}

/**
 * POST /instances — start an app. Returns the created instance (state may be "starting").
 * Use getInstance to poll until state === "running".
 * When `image` is set (e.g. local `repository:tag`), the server uses it as the container image override.
 */
export async function createInstance(
  connection: Connection,
  app: string,
  version: string,
  image?: string
): Promise<RobotAppInstance> {
  const payload =
    image !== undefined && image !== ""
      ? { app, version, image }
      : { app, version };
  const body = JSON.stringify(payload);
  const res = await signedFetch(connection, "POST", "/instances", body);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string })?.error ?? `start instance failed: ${res.status}`
    );
  }
  return res.json() as Promise<RobotAppInstance>;
}

/**
 * GET /instances/:id — get status of a single instance. Use to poll until state === "running".
 */
export async function getInstance(
  connection: Connection,
  instanceId: string
): Promise<RobotAppInstance> {
  const res = await signedFetch(connection, "GET", `/instances/${instanceId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string })?.error ?? `get instance failed: ${res.status}`
    );
  }
  return res.json() as Promise<RobotAppInstance>;
}

/**
 * DELETE /instances/:id — stop a running instance. Resolves when response is 200.
 */
export async function deleteInstance(
  connection: Connection,
  instanceId: string
): Promise<void> {
  const res = await signedFetch(connection, "DELETE", `/instances/${instanceId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string })?.error ?? `stop instance failed: ${res.status}`
    );
  }
}
