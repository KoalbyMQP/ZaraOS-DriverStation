/**
 * Auth and API config. Use NEXT_PUBLIC_ so it's available on the client.
 */
export const API_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:3001";

export const AUTH_TOKEN_KEY = "authToken";
