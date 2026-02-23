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
 * Perform a signed request to the robot API. Requires connection with token.
 */
export async function signedFetch(
  connection: Connection,
  method: string,
  path: string,
  body?: string
): Promise<Response> {
  const token = connection.token;
  if (!token) {
    throw new Error("Connection has no token; cannot sign request");
  }
  const b = body ?? "";
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
