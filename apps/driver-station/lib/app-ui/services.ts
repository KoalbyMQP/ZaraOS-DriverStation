import type { Connection } from "@/contexts/ConnectionContext";
import { signedFetch } from "@/lib/robot-api";
import type { AppServices } from "./types";

export function createAppServices(connection: Connection, instanceId: string, lifetime: AbortSignal): AppServices {
  return {
    async request(path, options = {}) {
      // Cortex owns the instance proxy. Do not let a component accidentally escape its instance's API.
      if (
        !path.startsWith("/") ||
        path.startsWith("//") ||
        /[\\#]/.test(path) ||
        Array.from(path).some((character) => character.charCodeAt(0) <= 32) ||
        path.split("?")[0].includes("%") ||
        path
          .split("?")[0]
          .split("/")
          .some((part) => part === "." || part === "..")
      ) {
        throw new Error("App requests must use a path within the instance API.");
      }
      const signal = options.signal ? AbortSignal.any([lifetime, options.signal]) : lifetime;
      signal.throwIfAborted();
      const response = await signedFetch(
        connection,
        options.method ?? "GET",
        `/instances/${encodeURIComponent(instanceId)}/api${path}`,
        options.body === undefined ? undefined : JSON.stringify(options.body),
        { signal }
      );
      if (!response.ok) throw new Error(`App request failed (${response.status}).`);
      if (response.status === 204) return null;
      return response.json() as Promise<unknown>;
    },
  };
}
