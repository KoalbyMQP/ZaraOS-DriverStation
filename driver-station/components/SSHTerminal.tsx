"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { sendTerminalCommand } from "@/lib/api";

const PROMPT = "user@driver-station:~$ ";

type Line = { type: "command"; text: string } | { type: "output"; text: string } | { type: "error"; text: string };

export function SSHTerminal() {
  const [lines, setLines] = useState<Line[]>([
    { type: "output", text: "SSH session connected. Type a command and press Enter." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [lines, input, scrollToBottom]);

  const sendCommand = useCallback(async () => {
    const cmd = input.trim();
    if (!cmd || sending) return;
    setInput("");
    setLines((prev) => [...prev, { type: "command", text: cmd }]);
    setSending(true);
    try {
      const result = await sendTerminalCommand(cmd);
      if (result.error) {
        setLines((prev) => [...prev, { type: "error", text: result.error }]);
      } else {
        const out = result.output ?? "";
        if (out) setLines((prev) => [...prev, { type: "output", text: out }]);
      }
    } catch (err) {
      setLines((prev) => [
        ...prev,
        { type: "error", text: err instanceof Error ? err.message : "Request failed" },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendCommand();
      }
    },
    [sendCommand]
  );

  return (
    <div
      className="overflow-hidden rounded-lg font-mono text-sm"
      style={{
        boxShadow: "0 0 0 1px rgba(59, 130, 246, 0.5), 0 0 20px 2px rgba(59, 130, 246, 0.25), 0 0 40px 4px rgba(59, 130, 246, 0.15)",
      }}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-zinc-700 bg-zinc-900/90 px-3 py-2">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-600/90" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-500/90" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/90" />
        </div>
        <span className="text-xs text-zinc-500">ssh — driver-station</span>
      </div>
      {/* Terminal body */}
      <div className="max-h-[420px] min-h-[320px] overflow-y-auto bg-[#0c0c0c] p-4">
        {lines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            {line.type === "command" && (
              <span className="text-amber-400/95">{PROMPT}</span>
            )}
            {line.type === "command" && <span className="text-emerald-300/95">{line.text}</span>}
            {line.type === "output" && <span className="text-zinc-400">{line.text}</span>}
            {line.type === "error" && <span className="text-red-400">{line.text}</span>}
            {(line.type === "output" || line.type === "error") && line.text && !line.text.endsWith("\n") && "\n"}
          </div>
        ))}
        <div className="flex items-center gap-0" ref={bottomRef}>
          <span className="text-amber-400/95">{PROMPT}</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            className="min-w-[12ch] flex-1 border-none bg-transparent py-0 pr-0 pl-1 text-emerald-300/95 caret-emerald-400 outline-none placeholder:text-zinc-600 disabled:opacity-60"
            placeholder={sending ? "..." : ""}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}
