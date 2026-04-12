"use client";

import { useRef, useEffect } from "react";
import type { Connection } from "@/contexts/ConnectionContext";
import { isLocalRobotHost } from "@/lib/robot-api";

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
 * Hook to stream logs from a running instance via EventSource (SSE).
 *
 * Uses callback refs so that changing `onLog`/`onError` references does NOT
 * tear down and re-open the EventSource.  The stream is only reconnected when
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
  // Stable refs for callbacks — avoids tearing down EventSource on every render
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
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let lastTs: string | null = null;

    const buildUrl = (since?: string) => {
      const base = `http://${connection.ip}:8080`;
      const params = new URLSearchParams({
        stream: "true",
        tail: tailCount.toString(),
      });
      if (since) params.append("since", since);
      return `${base}/instances/${instanceId}/logs?${params.toString()}`;
    };

    const scheduleReconnect = () => {
      if (!alive) return;
      if (!isLocalRobotHost(connection) && !connection.token) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        if (alive) connect(lastTs ?? undefined);
      }, 2000);
    };

    const connect = (since?: string) => {
      es?.close();
      const url = buildUrl(since);
      es = new EventSource(url);

      es.addEventListener("log", (event) => {
        try {
          const data = JSON.parse(
            (event as MessageEvent).data
          ) as LogEntry;
          lastTs = data.ts;
          if (alive) onLogRef.current(data);
        } catch (e) {
          console.error("Failed to parse log event", e);
        }
      });

      es.addEventListener("heartbeat", () => {
        // Connection alive — cancel any pending reconnect
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      });

      es.addEventListener("error", (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          if (alive) onErrorRef.current(data.message || "Stream ended");
        } catch {
          if (alive) onErrorRef.current("Connection lost");
        }
        es?.close();
        scheduleReconnect();
      });

      es.onerror = () => {
        if (es?.readyState === EventSource.CLOSED) {
          if (alive) onErrorRef.current("Connection closed");
          scheduleReconnect();
        }
      };
    };

    connect();

    return () => {
      alive = false;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [connection, instanceId, tailCount]);
}

export default useLogStream;
