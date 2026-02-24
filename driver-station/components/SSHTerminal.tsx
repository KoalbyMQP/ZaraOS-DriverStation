import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface Props {
  robotUrl: string; // e.g. "http://192.168.1.10:8080"
  signedFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onClose?: () => void;
}

export default function RobotTerminal({ robotUrl, signedFetch, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "monospace",
      fontSize: 14,
      theme: { background: "#0d1117" },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    let ws: WebSocket | null = null;
    let cancelled = false;

    const ro = new ResizeObserver(() => {
      fitAddon.fit(); // triggers term.onResize which calls sendResize
    });
    if (containerRef.current) ro.observe(containerRef.current);

    (async () => {
      // 1. Get a signed ticket from Cortex
      let ticket: string;
      try {
        const res = await signedFetch(`${robotUrl}/shell/ticket`, { method: "POST" });
        if (cancelled) return;
        if (!res.ok) throw new Error(`ticket request failed: ${res.status}`);
        const data = await res.json();
        ticket = data.ticket;
      } catch (err) {
        if (cancelled) return;
        term.writeln(`\r\n\x1b[31mFailed to connect: ${err}\x1b[0m`);
        return;
      }

      if (cancelled) return;

      // 2. Open WebSocket directly — ticket in query param
      const wsUrl = robotUrl.replace(/^http/, "ws") + `/shell?ticket=${encodeURIComponent(ticket)}`;
      ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        if (cancelled) return;
        fitAddon.fit(); // trigger initial resize
      };

      ws.onmessage = (e) => {
        if (cancelled) return;
        if (e.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(e.data));
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        term.writeln("\r\n\x1b[33m[disconnected]\x1b[0m");
        onClose?.();
      };

      ws.onerror = () => {
        if (cancelled) return;
        term.writeln("\r\n\x1b[31m[connection error]\x1b[0m");
      };

      // 3. Terminal input → WS
      term.onData((data) => {
        if (cancelled || ws?.readyState !== WebSocket.OPEN) return;
        ws.send(new TextEncoder().encode(data));
      });

      // 4. Resize → send control message
      const sendResize = () => {
        if (cancelled || ws?.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      };

      term.onResize(sendResize);

      // send initial size once open
      ws.addEventListener("open", sendResize, { once: true });
    })();

    return () => {
      cancelled = true;
      ro.disconnect();
      ws?.close();
      term.dispose();
    };
  }, [robotUrl]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", background: "#0d1117" }}
    />
  );
}