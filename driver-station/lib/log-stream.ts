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

export type LogEvent = {
  type: "log" | "heartbeat" | "error";
  timestamp: string;
  data: LogEntry | { message?: string };
};

/**
 * Hook to stream logs from a running instance via fetch + ReadableStream.
 *
 * Uses `signedFetch` so that auth headers (X-Timestamp / X-Signature) are
 * sent on the streaming request — the browser EventSource API cannot do this,
 * which caused 401s on non-localhost connections.
 *
 * Uses callback refs so that changing `onLog`/`onError` references does NOT
 * tear down and re-open the stream.  The connection is only restarted when
 * `connection`, `instanceId`, or `tailCount` actually change.
 *
 * Reconnects automatically with the `since` query-param to avoid duplicate
 * log lines after a network hiccup.
 */
export function useLogStream(
  connection: Connection | null,
  instanceId: string | null,
  onLog: (entry: LogEntry) => void,
  onError: (error: string) => void,
  tailCount: number = 100
) {
  // Stable refs for callbacks — avoids tearing down the stream on every render
  const onLogRef = useRef(onLog);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onLogRef.current = onLog;
  }, [onLog]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

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

        if (!res.ok || !res.body) {
          if (alive)
            onErrorRef.current(`Log stream failed: HTTP ${res.status}`);
          scheduleReconnect();
          return;
        }

        // Read the SSE stream via ReadableStream
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // eslint-disable-next-line no-constant-condition
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
                lastTs = entry.ts;
                if (alive) onLogRef.current(entry);
              } catch {
                /* skip malformed JSON */
              }
            } else if (event === "heartbeat") {
              // Connection alive — cancel any pending reconnect
              if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
              }
            } else if (event === "error") {
              try {
                const errData = JSON.parse(data) as { message?: string };
                if (alive)
                  onErrorRef.current(errData.message || "Stream ended");
              } catch {
                if (alive) onErrorRef.current("Stream ended");
              }
            }
          }
        }
      } catch (e) {
        // AbortError is expected when we intentionally close the stream
        if ((e as Error).name !== "AbortError" && alive) {
          onErrorRef.current("Connection lost");
        }
      }

      // Stream ended (container stopped, network error, etc.) — try again
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
