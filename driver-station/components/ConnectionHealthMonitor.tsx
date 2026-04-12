"use client";

import { useEffect } from "react";
import { useConnection } from "@/contexts/ConnectionContext";
import { checkRobotHealth } from "@/lib/robot-api";

const INTERVAL_MS = 60_000;

/**
 * After load and every 60s while a robot (or dev mode) connection exists,
 * GET /health; disconnect if the robot is unreachable or unhealthy.
 */
export default function ConnectionHealthMonitor() {
  const { connection, disconnect } = useConnection();

  useEffect(() => {
    if (!connection) return;

    let cancelled = false;

    const run = async () => {
      try {
        const ok = await checkRobotHealth(connection);
        if (cancelled) return;
        if (!ok) disconnect();
      } catch {
        if (cancelled) return;
        disconnect();
      }
    };

    void run();
    const id = window.setInterval(run, INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [connection, disconnect]);

  return null;
}
