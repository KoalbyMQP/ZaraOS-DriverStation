"use client";

import { useConnection } from "@/contexts/ConnectionContext";

function WifiIcon({ connected }: { connected: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={connected ? "text-emerald-500" : "text-zinc-500"}
    >
      <path d="M5 13a10 10 0 0 1 14 0" />
      <path d="M8.5 16.429a5 5 0 0 1 7 0" />
      <path d="M2 8.82a15 15 0 0 1 20 0" />
      <path d="M12 20h.01" />
    </svg>
  );
}

export function ConnectionStatusWidget() {
  const { connection } = useConnection();
  const connected = connection !== null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-800">
          <WifiIcon connected={connected} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Robot connection
          </p>
          {connected ? (
            <p className="truncate text-sm font-medium text-zinc-100">
              {connection!.name}
              <span className="ml-2 font-mono text-zinc-400">{connection!.ip}</span>
            </p>
          ) : (
            <p className="text-sm text-zinc-400">Not connected</p>
          )}
        </div>
        <div
          className={`h-2 w-2 shrink-0 rounded-full ${connected ? "bg-emerald-500" : "bg-zinc-600"}`}
          title={connected ? "Connected" : "Disconnected"}
        />
      </div>
    </div>
  );
}
