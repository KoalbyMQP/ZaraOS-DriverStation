"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/button";
import { ArrowDown01Icon, HugeiconsIcon, UnplugIcon, Wifi01Icon } from "@repo/ui/icons";
import { useConnection } from "@/contexts/ConnectionContext";
import { IpConnectModal } from "@/components/IpConnectModal";

export function RobotConnectionControl() {
  const { connection, connect, disconnect } = useConnection();
  const [ipConnectModalOpen, setIpConnectModalOpen] = useState(false);
  const [devModeLoading, setDevModeLoading] = useState(false);
  const [devModeError, setDevModeError] = useState<string | null>(null);

  // Preserve the original header's local development connection flow.
  const handleDevMode = async () => {
    setDevModeError(null);
    setDevModeLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch("http://127.0.0.1:8080/health", { method: "GET", signal: controller.signal });
      if (!res.ok) {
        setDevModeError(
          `Health check failed (${res.status}). Make sure to start ZaraOS on localhost and see setup instructions: https://github.com/KoalbyMQP/ZaraOS`
        );
        return;
      }
      connect("Dev Mode", "127.0.0.1", undefined, { devMode: true });
    } catch {
      setDevModeError(
        "Could not reach localhost:8080. Start ZaraOS on localhost and see setup instructions: https://github.com/KoalbyMQP/ZaraOS"
      );
    } finally {
      clearTimeout(timeoutId);
      setDevModeLoading(false);
    }
  };

  return (
    <div className="relative flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        className="h-10 gap-2 px-0 hover:bg-transparent"
        aria-label={connection ? `Connect to robot: ${connection.name}` : "Connect to robot: no robot connected"}
        aria-haspopup="dialog"
        onClick={() => {
          setDevModeError(null);
          setIpConnectModalOpen(true);
        }}
      >
        <HugeiconsIcon
          icon={Wifi01Icon}
          className={`size-6 ${connection ? "text-green-600" : "text-destructive"}`}
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <span className="max-w-40 truncate">{connection?.name ?? "No robot connected"}</span>
        <HugeiconsIcon icon={ArrowDown01Icon} className="size-4" strokeWidth={1.5} aria-hidden="true" />
      </Button>
      {connection ? (
        <Button variant="ghost" size="icon-xs" onClick={disconnect} aria-label="Disconnect" title="Disconnect">
          <HugeiconsIcon icon={UnplugIcon} strokeWidth={1.5} aria-hidden="true" />
        </Button>
      ) : (
        <Button variant="ghost" size="xs" onClick={handleDevMode} disabled={devModeLoading}>
          {devModeLoading ? "Checking…" : "Dev Mode"}
        </Button>
      )}
      {devModeError && (
        <p
          className="absolute top-full left-0 z-30 mt-2 w-72 rounded-lg border border-destructive/20 bg-background p-3 text-xs text-destructive shadow-md"
          role="alert"
        >
          {devModeError}
        </p>
      )}
      <IpConnectModal open={ipConnectModalOpen} onClose={() => setIpConnectModalOpen(false)} />
    </div>
  );
}
