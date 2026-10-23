"use client";

import { useLayoutEffect, useMemo, useState, useRef, useCallback } from "react";
import { Alert, AlertAction, AlertDescription } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@repo/ui/components/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@repo/ui/components/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@repo/ui/components/input-group";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";
import { CopyIcon, DownloadSimpleIcon, MagnifyingGlassIcon, PauseIcon, PlayIcon, XIcon } from "@repo/ui/icons";
import { cn } from "@repo/ui/lib/utils";
import type { Connection } from "@/contexts/ConnectionContext";
import { useLogStream, type LogEntry } from "@/lib/log-stream";

export type LogSeverity = "info" | "warn" | "error";

type LevelFilter = "all" | LogSeverity;

/** Infer severity for filtering and styling: stderr → error; stdout uses common log patterns. */
export function inferLogSeverity(entry: LogEntry): LogSeverity {
  if (entry.stream === "stderr") return "error";
  const line = entry.content;
  if (
    /\b(fatal|critical|panic|traceback|exception|err|error|\[error\]|\[critical\])\b/i.test(line) ||
    /^\s*error[\s:]/i.test(line)
  ) {
    return "error";
  }
  if (/\b(warn|warning|deprecated|deprecation|\[warn\]|\[warning\])\b/i.test(line)) {
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

const STICK_BOTTOM_THRESHOLD_PX = 56;
const levels: { id: LevelFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "info", label: "Normal" },
  { id: "warn", label: "Warn" },
  { id: "error", label: "Error" },
];

export function LogViewer({ connection, instanceId }: { connection: Connection | null; instanceId: string | null }) {
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

  const serializedLogs = logs.map((log) => `[${log.ts}] [${log.stream.toUpperCase()}] ${log.content}`).join("\n");

  const levelCounts = useMemo(() => {
    const c = { info: 0, warn: 0, error: 0 };
    for (const log of logs) {
      c[inferLogSeverity(log)] += 1;
    }
    return c;
  }, [logs]);

  const handleLog = (entry: LogEntry) => {
    if (!isPaused) {
      setLogs((prev) => [...prev, entry]);
    } else {
      logBufferRef.current.push(entry);
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
    <Card className="min-h-64 flex-1 overflow-hidden">
      <CardHeader className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>
            Logs{" "}
            <span className="text-sm font-normal text-muted-foreground tabular-nums">
              {logs.length} entries{filterActive ? ` · showing ${filteredLogs.length}` : ""}
            </span>
          </CardTitle>
          <ToggleGroup
            value={[levelFilter]}
            onValueChange={(value) => {
              if (value.length) setLevelFilter(value[0] as LevelFilter);
            }}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Filter by severity"
          >
            {levels.map(({ id, label }) => (
              <ToggleGroupItem key={id} value={id} aria-label={label}>
                {label}
                <span className="tabular-nums">{id === "all" ? logs.length : levelCounts[id]}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="min-w-40 flex-1">
            <InputGroupAddon>
              <MagnifyingGlassIcon />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label="Search logs"
              placeholder="Search messages…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </InputGroup>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePauseToggle}
            aria-label={isPaused ? "Resume streaming" : "Pause streaming"}
          >
            {isPaused ? <PlayIcon data-icon="inline-start" /> : <PauseIcon data-icon="inline-start" />}
            {isPaused ? "Paused" : "Live"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear}>
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy} aria-label="Copy logs">
            <CopyIcon data-icon="inline-start" />
            {copyLabel}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} aria-label="Download logs">
            <DownloadSimpleIcon data-icon="inline-start" />
            Download
          </Button>
        </div>
      </CardHeader>
      {error && (
        <Alert variant="destructive" className="mx-4 w-auto">
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <Button variant="ghost" size="icon-xs" aria-label="Dismiss log error" onClick={() => setError(null)}>
              <XIcon />
            </Button>
          </AlertAction>
        </Alert>
      )}
      <CardContent ref={scrollContainerRef} onScroll={handleScrollContainer} className="min-h-0 flex-1 overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{logs.length ? "No matching logs" : "Waiting for logs…"}</EmptyTitle>
              <EmptyDescription>
                {logs.length ? "Try another search or severity filter." : "New output will appear here."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="font-mono text-xs leading-relaxed">
            {filteredLogs.map((log, index) => {
              const severity = inferLogSeverity(log);
              return (
                <div
                  key={`${log.seq}-${log.ts}-${index}`}
                  className={cn("flex items-start gap-3 py-1.5", severity === "error" && "text-destructive")}
                >
                  <span className="shrink-0 text-muted-foreground tabular-nums" title={log.ts}>
                    {formatLogTime(log.ts)}
                  </span>
                  {severity !== "info" && (
                    <Badge variant={severity === "error" ? "destructive" : "secondary"}>
                      {severity === "warn" ? "WRN" : "ERR"}
                    </Badge>
                  )}
                  <span className="min-w-0 break-all whitespace-pre-wrap">{log.content}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground tabular-nums">
          {isPaused
            ? pendingWhilePaused
              ? `${pendingWhilePaused} new entries while paused`
              : "Paused"
            : "Streaming live"}
        </p>
      </CardFooter>
    </Card>
  );
}
