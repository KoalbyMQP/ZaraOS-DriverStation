"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Banner, Button, Dialog, Input, Label } from "@repo/ui/kumo";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@repo/ui/components/input-otp";
import { CodeIcon, PlugIcon, WarningCircleIcon, XIcon } from "@repo/ui/icons";
import { useConnection } from "@/contexts/ConnectionContext";
import { derivePairingToken } from "@/lib/robot-auth";
import { mixedContentHint, robotBaseUrl } from "@/lib/robot-api";

type PendingPair = { baseUrl: string; name: string; ip: string; expiresIn: number };

export function IpConnectModal({ onClose }: { onClose: () => void }) {
  const { connection, connect, disconnect } = useConnection();
  const [name, setName] = useState("Robot");
  const [ip, setIp] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<PendingPair | null>(null);
  const [loading, setLoading] = useState<"pair" | "dev" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lifecycle = useRef(new AbortController());

  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    return () => controller.abort();
  }, []);

  async function request(url: string, init?: RequestInit) {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        signal: AbortSignal.any([lifecycle.current.signal, AbortSignal.timeout(5000)]),
      });
    } catch (err) {
      // A blocked request fails like an unreachable robot; name the likely cause.
      const hint = err instanceof TypeError ? mixedContentHint(url) : null;
      if (hint) throw new Error(`Could not reach the robot. ${hint}`);
      throw err;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
    return data;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading("pair");
    try {
      if (pending) {
        const data = await request(`${pending.baseUrl}/auth/pair/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, label: pending.name }),
        });
        if (typeof data.salt !== "string") throw new Error("The robot returned an invalid pairing response.");
        const token = await derivePairingToken(code, data.salt);
        if (lifecycle.current.signal.aborted) return;
        connect(pending.name, pending.ip, token);
        onClose();
      } else {
        const baseUrl = robotBaseUrl({ ip: ip.trim() });
        const data = await request(`${baseUrl}/auth/pair/start`, { method: "POST" });
        if (lifecycle.current.signal.aborted) return;
        setPending({ baseUrl, name: name.trim() || "Robot", ip: ip.trim(), expiresIn: data.expires_in ?? 120 });
        setCode("");
      }
    } catch (err) {
      if (!lifecycle.current.signal.aborted)
        setError(err instanceof Error ? err.message : "Could not connect. Check the address and try again.");
    } finally {
      if (!lifecycle.current.signal.aborted) setLoading(null);
    }
  }

  async function connectDevMode() {
    setError(null);
    setLoading("dev");
    try {
      await request("http://127.0.0.1:8080/health");
      if (lifecycle.current.signal.aborted) return;
      connect("Dev Mode", "127.0.0.1", undefined, { devMode: true });
      onClose();
    } catch {
      if (!lifecycle.current.signal.aborted)
        setError("Could not reach local Cortex. Start Cortex on this computer at 127.0.0.1:8080, then try again.");
    } finally {
      if (!lifecycle.current.signal.aborted) setLoading(null);
    }
  }

  return (
    <Dialog className="flex flex-col gap-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Dialog.Title className="text-lg font-semibold">
            {pending ? "Enter pairing code" : "Connect to robot"}
          </Dialog.Title>
          <Dialog.Description className="text-kumo-subtle">
            {pending
              ? "Enter the six-digit code displayed on your robot."
              : "Connect over your network, or use a local Cortex server."}
          </Dialog.Description>
        </div>
        <Dialog.Close
          render={
            <Button variant="ghost" shape="square" size="sm" aria-label="Close" className="-mt-1 -mr-2 shrink-0" />
          }
        >
          <XIcon size={16} />
        </Dialog.Close>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && (
          <Banner role="alert" variant="error" icon={<WarningCircleIcon weight="fill" />} description={error} />
        )}
        {pending ? (
          <div className="grid gap-2">
            <Label htmlFor="pairing-code">Pairing code</Label>
            <InputOTP
              id="pairing-code"
              maxLength={6}
              pattern="^[0-9]*$"
              value={code}
              onChange={(value) => {
                setCode(value);
                setError(null);
              }}
              disabled={!!loading}
              aria-invalid={!!error}
              autoFocus
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }, (_, index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <p className="text-sm leading-snug text-kumo-subtle">
              Codes are valid for {pending.expiresIn} seconds. Go back to request a new one.
            </p>
          </div>
        ) : (
          <>
            {connection && (
              <div className="flex items-center gap-3 rounded-lg bg-kumo-recessed px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">Connected to {connection.name}</p>
                  <p className="truncate text-sm text-kumo-subtle">{connection.ip}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    disconnect();
                    onClose();
                  }}
                >
                  Disconnect
                </Button>
              </div>
            )}
            <Input
              label="Device name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Robot"
              disabled={!!loading}
            />
            <Input
              label="IP address"
              description="Use the robot’s IP address or hostname. The default port is 8080. Enter an https:// address if the robot has one."
              value={ip}
              onChange={(e) => {
                setIp(e.target.value);
                setError(null);
              }}
              placeholder="192.168.1.42"
              required
              disabled={!!loading}
              autoComplete="off"
            />
            <Button
              type="submit"
              variant="primary"
              icon={PlugIcon}
              loading={loading === "pair"}
              disabled={!!loading || !ip.trim()}
              className="w-full justify-center"
            >
              Connect
            </Button>
            <div className="flex items-center gap-3 text-sm text-kumo-subtle">
              <span className="h-px flex-1 bg-kumo-line" />
              Local development
              <span className="h-px flex-1 bg-kumo-line" />
            </div>
            <div className="grid gap-2">
              <Button
                icon={CodeIcon}
                loading={loading === "dev"}
                disabled={!!loading}
                onClick={connectDevMode}
                className="w-full justify-center"
              >
                Dev Mode
              </Button>
              <p className="text-sm leading-snug text-kumo-subtle">
                Connect to Cortex on this computer without pairing.
              </p>
            </div>
          </>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="ghost"
            onClick={
              pending
                ? () => {
                    setPending(null);
                    setError(null);
                    setCode("");
                  }
                : onClose
            }
            disabled={!!pending && !!loading}
          >
            {pending ? "Back" : "Cancel"}
          </Button>
          {pending && (
            <Button type="submit" variant="primary" loading={!!loading} disabled={code.length !== 6}>
              Pair
            </Button>
          )}
        </div>
      </form>
    </Dialog>
  );
}
