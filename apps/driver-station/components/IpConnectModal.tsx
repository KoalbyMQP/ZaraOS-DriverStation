"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/components/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@repo/ui/components/input-otp";
import { Spinner } from "@repo/ui/components/spinner";
import { CodeIcon, PlugIcon, WarningCircleIcon } from "@repo/ui/icons";
import { useConnection } from "@/contexts/ConnectionContext";
import { derivePairingToken } from "@/lib/robot-auth";
import { robotBaseUrl } from "@/lib/robot-api";

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
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.any([lifecycle.current.signal, AbortSignal.timeout(5000)]),
    });
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
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{pending ? "Enter pairing code" : "Connect to robot"}</DialogTitle>
        <DialogDescription>
          {pending
            ? "Enter the six-digit code displayed on your robot."
            : "Connect over your network, or use a local Cortex server."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="flex flex-col gap-5">
        {error && (
          <Alert variant="destructive">
            <WarningCircleIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <FieldGroup>
          {pending ? (
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="pairing-code">Pairing code</FieldLabel>
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
              <FieldDescription>
                Codes are valid for {pending.expiresIn} seconds. Go back to request a new one.
              </FieldDescription>
            </Field>
          ) : (
            <>
              {connection && (
                <Field orientation="horizontal">
                  <div className="min-w-0 flex-1">
                    <FieldLabel>Connected to {connection.name}</FieldLabel>
                    <FieldDescription>{connection.ip}</FieldDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      disconnect();
                      onClose();
                    }}
                  >
                    Disconnect
                  </Button>
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="robot-name">Device name</FieldLabel>
                <Input
                  id="robot-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Robot"
                  disabled={!!loading}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="robot-address">IP address</FieldLabel>
                <Input
                  id="robot-address"
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
                <FieldDescription>Use the robot’s IP address or hostname. The default port is 8080.</FieldDescription>
              </Field>
              <Button type="submit" disabled={!!loading || !ip.trim()}>
                {loading === "pair" ? <Spinner data-icon="inline-start" /> : <PlugIcon data-icon="inline-start" />}
                Connect
              </Button>
              <FieldSeparator>Local development</FieldSeparator>
              <Field>
                <Button type="button" variant="outline" disabled={!!loading} onClick={connectDevMode}>
                  {loading === "dev" ? <Spinner data-icon="inline-start" /> : <CodeIcon data-icon="inline-start" />}Dev
                  Mode
                </Button>
                <FieldDescription>Connect to Cortex on this computer without pairing.</FieldDescription>
              </Field>
            </>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button
            type="button"
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
            disabled={pending && !!loading ? true : undefined}
          >
            {pending ? "Back" : "Cancel"}
          </Button>
          {pending && (
            <Button type="submit" disabled={!!loading || code.length !== 6}>
              {loading && <Spinner data-icon="inline-start" />}Pair
            </Button>
          )}
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
