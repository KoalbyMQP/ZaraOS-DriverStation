"use client";

import dynamic from "next/dynamic";
import { useCallback } from "react";
import { useConnection } from "@/contexts/ConnectionContext";
import { signedFetch } from "@/lib/robot-api";

const RobotTerminal = dynamic(() => import("@/components/SSHTerminal"), {
  ssr: false,
  loading: () => <p className="p-4 font-mono text-sm text-muted-foreground">Opening terminal…</p>,
});

export default function ConsolePage() {
  const { connection } = useConnection();
  const fetchTerminal = useCallback(
    (url: string, init?: RequestInit) => {
      if (!connection) return Promise.reject(new Error("No robot connected"));
      return signedFetch(connection, init?.method ?? "GET", new URL(url).pathname, init?.body as string | undefined);
    },
    [connection]
  );

  return (
    <div className="flex h-full min-h-[28rem] flex-col md:min-h-0">
      <div role="tablist" aria-label="Terminal sessions" className="flex shrink-0 bg-sidebar">
        <button
          id="terminal-tab"
          type="button"
          role="tab"
          aria-selected="true"
          aria-controls="terminal-panel"
          className="border-t border-r border-t-primary border-r-border bg-background px-3 py-2.5 font-mono text-[13px] leading-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          Terminal
        </button>
        <div className="flex-1 border-b border-border" />
      </div>
      <section
        id="terminal-panel"
        role="tabpanel"
        aria-labelledby="terminal-tab"
        className="min-h-0 flex-1 overflow-hidden"
      >
        {connection ? (
          <RobotTerminal robotUrl={`http://${connection.ip}:8080`} signedFetch={fetchTerminal} />
        ) : (
          <p className="p-4 font-mono text-sm text-muted-foreground">
            No robot connected. Use the Connect button in the header.
          </p>
        )}
      </section>
    </div>
  );
}
