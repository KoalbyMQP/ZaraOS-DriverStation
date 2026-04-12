"use client";

import { useLayoutEffect, useMemo, useState, useRef, useCallback } from "react";
import type { Connection } from "@/contexts/ConnectionContext";
import { useLogStream, type LogEntry } from "@/lib/log-stream";

export type LogSeverity = "info" | "warn" | "error";

type LevelFilter = "all" | LogSeverity;

/** Infer severity for filtering and styling: stderr → error; stdout uses common log patterns. */
export function inferLogSeverity(entry: LogEntry): LogSeverity {
  if (entry.stream === "stderr") return "error";
  const line = entry.content;
  if (
    /\b(fatal|critical|panic|traceback|exception|err|error|\[error\]|\[critical\])\b/i.test(
      line
    ) ||
    /^\s*error[\s:]/i.test(line)
  ) {
    return "error";
  }
  if (
    /\b(warn|warning|deprecated|deprecation|\[warn\]|\[warning\])\b/i.test(line)
  ) {
    return "warn";
  }
  return "info";
}

function formatLogTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const t = iso.replace(/Z$/, "").split("T")[1];
    return t ? t.replace(/\.\d+/, (m) => m.slice(0, 4)) : iso;
  }
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  const s = d.getSeconds().toString().padStart(2, "0");
  const ms = d.getMilliseconds().toString().padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

const LEVEL_ROW_CLASS: Record<LogSeverity, string> = {
  info: "log-viewer-row log-viewer-row--info border-l-zinc-600 text-zinc-300",
  warn: "log-viewer-row log-viewer-row--warn border-l-amber-500/80 bg-amber-950/20 text-amber-100/95",
  error: "log-viewer-row log-viewer-row--error border-l-red-500 bg-red-950/25 text-red-100/95",
};

const LEVEL_BADGE_CLASS: Record<LogSeverity, string> = {
  info: "bg-zinc-800/80 text-zinc-500",
  warn: "log-viewer-badge log-viewer-badge--warn bg-amber-900/40 text-amber-300/90",
  error: "log-viewer-badge log-viewer-badge--error bg-red-900/40 text-red-300/90",
};

/** Pixels from the bottom to still count as “following” the tail. */
const STICK_BOTTOM_THRESHOLD_PX = 56;

const LEVEL_FILTER_META: {
  id: LevelFilter;
  label: string;
  short: string;
  tone: "neutral" | "warn" | "error";
}[] = [
  { id: "all", label: "All levels", short: "All", tone: "neutral" },
  { id: "info", label: "Normal — standard output lines", short: "Normal", tone: "neutral" },
  { id: "warn", label: "Warnings — warn, deprecated, etc.", short: "Warn", tone: "warn" },
  { id: "error", label: "Errors — stderr and error patterns", short: "Error", tone: "error" },
];

function LogSeverityTabIcon({
  level,
  className = "h-3.5 w-3.5 shrink-0",
}: {
  level: "warn" | "error";
  className?: string;
}) {
  if (level === "warn") {
    return (
      <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden>
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden>
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function severityTabClass(tone: "neutral" | "warn" | "error", active: boolean): string {
  if (tone === "warn") {
    return active
      ? "bg-amber-500/20 text-amber-100 shadow-sm ring-1 ring-inset ring-amber-400/35"
      : "text-amber-400/95 hover:bg-amber-950/55 hover:text-amber-300";
  }
  if (tone === "error") {
    return active
      ? "bg-red-500/20 text-red-100 shadow-sm ring-1 ring-inset ring-red-500/40"
      : "text-red-400/95 hover:bg-red-950/45 hover:text-red-300";
  }
  return active
    ? "bg-zinc-700 text-zinc-100 shadow-sm"
    : "text-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-300";
}

function severityTabCountClass(
  tone: "neutral" | "warn" | "error",
  active: boolean
): string {
  const base = "ml-0.5 tabular-nums";
  if (tone === "warn") {
    return `${base} ${active ? "text-amber-200/75" : "text-amber-500/85"}`;
  }
  if (tone === "error") {
    return `${base} ${active ? "text-red-200/75" : "text-red-400/85"}`;
  }
  return `${base} text-zinc-500`;
}

export function LogViewer({
  connection,
  instanceId,
}: {
  connection: Connection | null;
  instanceId: string | null;
}) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [pendingWhilePaused, setPendingWhilePaused] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  /** When true, new lines while Live will keep the viewport pinned to the bottom. */
  const stickToBottomRef = useRef(true);
  const logBufferRef = useRef<LogEntry[]>([]);

  const serializedLogs = logs
    .map((log) => `[${log.ts}] [${log.stream.toUpperCase()}] ${log.content}`)
    .join("\n");
  const actionButtonClass =
    "inline-flex items-center gap-2 rounded bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-700";

  const levelCounts = useMemo(() => {
    const c = { info: 0, warn: 0, error: 0 };
    for (const log of logs) {
      c[inferLogSeverity(log)] += 1;
    }
    return c;
  }, [logs]);

  const handleLog = (entry: LogEntry) => {
    logBufferRef.current.push(entry);
    if (!isPaused) {
      setLogs((prev) => [...prev, entry]);
    } else {
      setPendingWhilePaused((n) => n + 1);
    }
  };

  const handleError = (errorMsg: string) => {
    setError(errorMsg);
  };

  useLogStream(connection, instanceId, handleLog, handleError);

  const handleScrollContainer = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const dist = scrollHeight - scrollTop - clientHeight;
    stickToBottomRef.current = dist <= STICK_BOTTOM_THRESHOLD_PX;
  }, []);

  const handlePauseToggle = () => {
    if (isPaused) {
      // Resume and show buffered logs
      stickToBottomRef.current = true;
      setLogs((prev) => [...prev, ...logBufferRef.current]);
      logBufferRef.current = [];
      setPendingWhilePaused(0);
    } else {
      setPendingWhilePaused(0);
    }
    setIsPaused(!isPaused);
  };

  const handleClear = () => {
    stickToBottomRef.current = true;
    setLogs([]);
    logBufferRef.current = [];
    setPendingWhilePaused(0);
    setError(null);
    setCopyLabel("Copy");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(serializedLogs);
      setCopyLabel("Copied");
      window.setTimeout(() => setCopyLabel("Copy"), 1500);
    } catch {
      setCopyLabel("Failed");
      window.setTimeout(() => setCopyLabel("Copy"), 1500);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([serializedLogs], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return logs.filter((log) => {
      const sev = inferLogSeverity(log);
      if (levelFilter !== "all" && sev !== levelFilter) return false;
      if (!q) return true;
      return (
        log.content.toLowerCase().includes(q) ||
        log.stream.toLowerCase().includes(q) ||
        formatLogTime(log.ts).includes(q)
      );
    });
  }, [logs, filter, levelFilter]);

  const filterActive = levelFilter !== "all" || filter.trim().length > 0;

  useLayoutEffect(() => {
    if (isPaused || !stickToBottomRef.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs.length, filteredLogs.length, isPaused]);

  return (
    <div className="log-viewer flex h-full min-h-0 flex-col rounded-lg border border-zinc-800 bg-zinc-900">
      {/* Header with controls */}
      <div className="flex flex-col gap-3 border-b border-zinc-800 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3 className="font-medium text-zinc-100">Logs</h3>
            <span className="text-sm text-zinc-500">
              {logs.length} {logs.length === 1 ? "entry" : "entries"}
              {filterActive && logs.length > 0 && (
                <span className="text-zinc-600">
                  {" "}
                  · showing {filteredLogs.length}
                </span>
              )}
            </span>
          </div>
          <div
            className="log-viewer-severity-tabs flex flex-wrap items-center gap-0.5 rounded-lg bg-zinc-950/60 p-0.5 ring-1 ring-inset ring-zinc-800"
            role="group"
            aria-label="Filter by severity"
          >
            {LEVEL_FILTER_META.map(({ id, label, short, tone }) => {
              const active = levelFilter === id;
              const count =
                id === "all"
                  ? logs.length
                  : levelCounts[id as LogSeverity];
              return (
                <button
                  key={id}
                  type="button"
                  data-state={active ? "active" : "inactive"}
                  data-severity={id}
                  title={`${label}${id !== "all" ? ` (${count})` : ""}`}
                  onClick={() => setLevelFilter(id)}
                  className={`log-viewer-severity-tab inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${severityTabClass(tone, active)}`}
                >
                  {id === "warn" && <LogSeverityTabIcon level="warn" />}
                  {id === "error" && <LogSeverityTabIcon level="error" />}
                  {short}
                  {id !== "all" && (
                    <span className={severityTabCountClass(tone, active)}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search message…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="min-w-[10rem] flex-1 rounded-md bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handlePauseToggle}
            className={`rounded px-2 py-1 text-sm font-medium transition-colors ${
              isPaused
                ? "bg-amber-900/50 text-amber-300 hover:bg-amber-900"
                : "log-viewer-btn-live bg-emerald-950/80 text-emerald-300 ring-1 ring-inset ring-emerald-500/35 hover:bg-emerald-900/70 hover:text-emerald-200"
            }`}
            title={isPaused ? "Resume streaming" : "Pause streaming"}
          >
            {isPaused ? "Paused" : "Live"}
          </button>
          <button
            onClick={handleClear}
            className={actionButtonClass}
            title="Clear logs"
          >
            Clear
          </button>
          <button
            onClick={handleCopy}
            className={actionButtonClass}
            title="Copy logs"
            aria-label="Copy logs"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <rect x="9" y="9" width="10" height="10" rx="2" strokeWidth="1.8" />
              <path
                d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{copyLabel}</span>
          </button>
          <button
            onClick={handleDownload}
            className={actionButtonClass}
            title="Download logs"
            aria-label="Download logs"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Download</span>
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
      <div
        ref={scrollContainerRef}
        onScroll={handleScrollContainer}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-500">
            {logs.length === 0
              ? "Waiting for logs…"
              : filterActive
                ? "No lines match the current filters."
                : "No logs yet."}
          </div>
        ) : (
          <div className="font-mono text-[13px] leading-relaxed">
            {filteredLogs.map((log, idx) => {
              const sev = inferLogSeverity(log);
              return (
                <div
                  key={`${log.seq}-${log.ts}-${idx}`}
                  className={`flex gap-3 border-b border-zinc-800/40 border-l-2 px-4 py-1.5 ${LEVEL_ROW_CLASS[sev]}`}
                >
                  <span
                    className="w-[5.5rem] shrink-0 select-none tabular-nums text-zinc-500"
                    title={log.ts}
                  >
                    {formatLogTime(log.ts)}
                  </span>
                  <span className="flex min-w-0 flex-1 gap-2">
                    {sev !== "info" ? (
                      <span
                        className={`w-10 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide ${LEVEL_BADGE_CLASS[sev]}`}
                      >
                        {sev === "warn" ? "WRN" : "ERR"}
                      </span>
                    ) : (
                      <span className="w-10 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0 break-all">{log.content}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-500">
        {isPaused && pendingWhilePaused > 0 && (
          <span>{pendingWhilePaused} new entries while paused</span>
        )}
        {isPaused && pendingWhilePaused === 0 && <span>Paused</span>}
        {!isPaused && <span>Streaming live</span>}
      </div>
    </div>
  );
}
