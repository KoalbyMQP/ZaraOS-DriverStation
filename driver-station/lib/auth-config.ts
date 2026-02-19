/**
 * Auth and API config. Use NEXT_PUBLIC_ so it's available on the client.
 */
export const API_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:3001";

export const AUTH_TOKEN_KEY = "authToken";

/** Cookie name for auth token (read by middleware; set by client). */
export const AUTH_COOKIE_NAME = "authToken";

/** Cookie max age in seconds (7 days). */
export const AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;
