"use client";

import { useRef, useEffect } from "react";
import type { Connection } from "@/contexts/ConnectionContext";
import { signedFetch, isLocalRobotHost } from "@/lib/robot-api";

export type LogEntry = {
  ts: string;
  seq: number;
  stream: "stdout" | "stderr";
  content: string;
};

export type LogStreamHandlers = {
  onLog: (entry: LogEntry) => void;
  onError: (error: string) => void;
  /** The instance is not running, so no more lines will come. `state` is the instance's state. */
  onEnd: (state: string) => void;
};

/**
 * Hook to stream logs from a running instance via fetch + ReadableStream.
 *
 * Uses `signedFetch` so that auth headers (X-Timestamp / X-Signature) are
 * sent on the streaming request — the browser EventSource API cannot do this,
 * which caused 401s on non-localhost connections.
 *
 * Uses a ref for the handlers so that changing their references does NOT
 * tear down and re-open the stream.  The connection is only restarted when
 * `connection`, `instanceId`, or `tailCount` actually change.
 *
 * One request stays open and Cortex pushes lines as the app logs them. The
 * stream is only reopened (with the `since` query-param) after it breaks while
 * the instance is still running. Once Cortex says the instance has ended, or
 * no longer knows it, nothing more is requested.
 */
export function useLogStream(
  connection: Connection | null,
  instanceId: string | null,
  handlers: LogStreamHandlers,
  tailCount: number = 100
) {
  // Stable ref for the handlers — avoids tearing down the stream on every render
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!connection || !instanceId) return;

    let alive = true;
    let controller: AbortController | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let lastTs: string | null = null;

    const scheduleReconnect = () => {
      if (!alive) return;
      if (!isLocalRobotHost(connection) && !connection.token) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        if (alive) connect(lastTs ?? undefined);
      }, 2000);
    };

    const connect = async (since?: string) => {
      controller?.abort();
      controller = new AbortController();

      const params = new URLSearchParams({
        stream: "true",
        tail: tailCount.toString(),
      });
      if (since) params.append("since", since);
      const path = `/instances/${instanceId}/logs?${params}`;

      try {
        const res = await signedFetch(connection, "GET", path, undefined, {
          signal: controller.signal,
        });

        if (res.status === 404) {
          // Cortex forgets instances when it restarts; asking again will not bring this one back.
          if (alive) handlersRef.current.onError("The robot no longer has this instance.");
          return;
        }
        if (!res.ok || !res.body) {
          if (alive) handlersRef.current.onError(`Log stream failed: HTTP ${res.status}`);
          scheduleReconnect();
          return;
        }

        // Read the SSE stream via ReadableStream
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done || !alive) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE events are delimited by double newlines
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            if (!chunk.trim()) continue;

            const lines = chunk.split("\n");
            let event = "message";
            let data = "";

            for (const line of lines) {
              if (line.startsWith("event: ")) event = line.slice(7);
              else if (line.startsWith("data: ")) data = line.slice(6);
              else if (line.startsWith("id: ")) {
                /* currently unused but spec-compliant */
              }
            }

            if (event === "log" && data) {
              try {
                const entry = JSON.parse(data) as LogEntry;
                // A reopened stream starts with the lines stamped exactly `since`, which were already shown.
                if (entry.ts === since) continue;
                lastTs = entry.ts;
                if (alive) handlersRef.current.onLog(entry);
              } catch {
                /* skip malformed JSON */
              }
            } else if (event === "end") {
              let state = "stopped";
              try {
                state = (JSON.parse(data) as { state?: string }).state || state;
              } catch {
                /* keep the default */
              }
              if (alive) handlersRef.current.onEnd(state);
              // Nothing more will come: close the request and do not reopen it.
              controller.abort();
              return;
            } else if (event === "heartbeat") {
              // Connection alive — cancel any pending reconnect
              if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
              }
            } else if (event === "error") {
              try {
                const errData = JSON.parse(data) as { message?: string };
                if (alive) handlersRef.current.onError(errData.message || "Stream ended");
              } catch {
                if (alive) handlersRef.current.onError("Stream ended");
              }
            }
          }
        }
      } catch (e) {
        // AbortError is expected when we intentionally close the stream
        if ((e as Error).name !== "AbortError" && alive) {
          handlersRef.current.onError("Connection lost");
        }
      }

      // Stream broke without Cortex ending it (network error, older Cortex) — try again
      scheduleReconnect();
    };

    connect();

    return () => {
      alive = false;
      controller?.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [connection, instanceId, tailCount]);
}

export default useLogStream;
