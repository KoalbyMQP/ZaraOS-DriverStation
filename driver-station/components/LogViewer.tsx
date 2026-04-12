"use client";

import { useState, useRef } from "react";
import type { Connection } from "@/contexts/ConnectionContext";
import { useLogStream, type LogEntry } from "@/lib/log-stream";

export function LogViewer({
  connection,
  instanceId,
}: {
  connection: Connection | null;
  instanceId: string | null;
}) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logBufferRef = useRef<LogEntry[]>([]);

  const handleLog = (entry: LogEntry) => {
    logBufferRef.current.push(entry);
    if (!isPaused) {
      setLogs((prev) => [...prev, entry]);
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleError = (errorMsg: string) => {
    setError(errorMsg);
  };

  useLogStream(connection, instanceId, handleLog, handleError);

  const handlePauseToggle = () => {
    if (isPaused) {
      // Resume and show buffered logs
      setLogs((prev) => [...prev, ...logBufferRef.current]);
      logBufferRef.current = [];
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    setIsPaused(!isPaused);
  };

  const handleClear = () => {
    setLogs([]);
    logBufferRef.current = [];
    setError(null);
  };

  const handleDownload = () => {
    const content = logs
      .map((log) => `[${log.ts}] [${log.stream.toUpperCase()}] ${log.content}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = filter
    ? logs.filter((log) =>
        log.content.toLowerCase().includes(filter.toLowerCase())
      )
    : logs;

  return (
    <div className="flex h-full flex-col rounded-lg border border-zinc-800 bg-zinc-900">
      {/* Header with controls */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-zinc-100">Logs</h3>
          <span className="text-sm text-zinc-500">
            {logs.length} {logs.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handlePauseToggle}
            className={`rounded px-2 py-1 text-sm font-medium transition-colors ${
              isPaused
                ? "bg-amber-900/50 text-amber-300 hover:bg-amber-900"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
            title={isPaused ? "Resume streaming" : "Pause streaming"}
          >
            {isPaused ? "Paused" : "Live"}
          </button>
          <button
            onClick={handleClear}
            className="rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-700"
            title="Clear logs"
          >
            Clear
          </button>
          <button
            onClick={handleDownload}
            className="rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-700"
            title="Download logs"
          >
            ↓
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="border-b border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-300">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-300 hover:text-red-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Logs display */}
      <div className="flex-1 overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-zinc-500">
            {logs.length === 0 ? "Waiting for logs..." : "No logs match filter"}
          </div>
        ) : (
          <div className="font-mono text-sm">
            {filteredLogs.map((log, idx) => (
              <div
                key={idx}
                className={`border-b border-zinc-800/50 px-4 py-1 ${
                  log.stream === "stderr"
                    ? "bg-red-950/10 text-red-300"
                    : "text-zinc-300"
                }`}
              >
                <span className="text-zinc-500">[{log.ts}]</span>{" "}
                <span className="text-zinc-600">
                  [{log.stream.toUpperCase()}]
                </span>{" "}
                {log.content}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-500">
        {isPaused && logBufferRef.current.length > 0 && (
          <span>{logBufferRef.current.length} new entries while paused</span>
        )}
        {isPaused && logBufferRef.current.length === 0 && <span>Paused</span>}
        {!isPaused && <span>Streaming live</span>}
      </div>
    </div>
  );
}
