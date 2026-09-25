"use client";

import { useState } from "react";
import { useConnection } from "@/contexts/ConnectionContext";
import { connectBLEAndGetIP } from "@/lib/ble-get-ip";
import { derivePairingToken } from "@/lib/robot-auth";

type IpConnectModalProps = {
  open: boolean;
  onClose: () => void;
};

type PairStep = "ip" | "code";

type PendingPair = {
  baseUrl: string;
  name: string;
  ip: string;
  expiresIn: number;
};

export function IpConnectModal({ open, onClose }: IpConnectModalProps) {
  const { connect } = useConnection();
  const [deviceNameInput, setDeviceNameInput] = useState("Robot");
  const [ipAddressInput, setIpAddressInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pairStep, setPairStep] = useState<PairStep>("ip");
  const [pendingPair, setPendingPair] = useState<PendingPair | null>(null);
  const [codeInput, setCodeInput] = useState("");

  if (!open) return null;

  const handleClose = () => {
    setError(null);
    setPairStep("ip");
    setPendingPair(null);
    setCodeInput("");
    onClose();
  };

  /**
   * Step 1: POST auth/pair/start. On success, show code entry popup.
   */
  const submitConnection = async (name: string, ip: string) => {
    const trimmedName = name.trim() || "Robot";
    const trimmedIp = ip.trim();
    if (!trimmedIp) return;
    setError(null);
    setLoading(true);
    try {
      const baseUrl = trimmedIp.includes(":")
        ? `http://${trimmedIp}`
        : `http://${trimmedIp}:8080`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`${baseUrl}/auth/pair/start`, {
        method: "POST",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        let message = "Could not connect to the robot.";
        try {
          const data = (await res.json()) as { error?: string };
          if (typeof data?.error === "string" && data.error) {
            message = data.error;
          }
        } catch {
          // use default message
        }
        setError(message);
        return;
      }
      const data = (await res.json()) as { expires_in?: number };
      const expiresIn = typeof data?.expires_in === "number" ? data.expires_in : 120;
      setPendingPair({ baseUrl, name: trimmedName, ip: trimmedIp, expiresIn });
      setPairStep("code");
      setCodeInput("");
    } catch {
      setError(
        "Could not reach the robot. Check the IP address and that the robot is powered on and on the same network."
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Step 2: User enters 6-digit code → POST auth/pair/complete, derive token, persist connection.
   */
  const submitCode = async () => {
    const code = codeInput.replace(/\D/g, "");
    if (!pendingPair || code.length !== 6) {
      setError("Please enter the 6-digit code from the robot.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${pendingPair.baseUrl}/auth/pair/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, label: pendingPair.name || "Driver Station" }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(typeof data?.error === "string" && data.error ? data.error : "Invalid or expired code.");
        return;
      }
      const data = (await res.json()) as { salt: string };
      if (typeof data?.salt !== "string") {
        setError("Invalid response from robot.");
        return;
      }
      const token = await derivePairingToken(code, data.salt);
      connect(pendingPair.name, pendingPair.ip, token);
      handleClose();
    } catch {
      setError("Could not complete pairing. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFindIPWithBluetooth = async () => {
    setError(null);
    setLoading(true);
    try {
      const { name, ip } = await connectBLEAndGetIP();
      if (!ip?.trim()) {
        setError("Robot did not return an IP address.");
        return;
      }
      await submitConnection(name, ip);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Bluetooth connection failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    await submitConnection(deviceNameInput, ipAddressInput);
  };

  const backToIpStep = () => {
    setPairStep("ip");
    setPendingPair(null);
    setCodeInput("");
    setError(null);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ip-connect-title"
    >
      <div
        className="w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-800 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {pairStep === "code" ? (
          <>
            <h2 id="ip-connect-title" className="text-lg font-semibold text-zinc-100">
              Enter pairing code
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Enter the 6-digit code displayed on the robot.
            </p>
            {pendingPair && (
              <p className="mt-1 text-xs text-zinc-500">
                Code expires in {pendingPair.expiresIn} seconds.
              </p>
            )}
            {error && (
              <div
                className="mt-4 rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-200"
                role="alert"
              >
                {error}
              </div>
            )}
            <label className="mt-4 block text-sm font-medium text-zinc-300">6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError(null);
              }}
              placeholder="000000"
              className="focus-blue-glow mt-1 w-full rounded-md border border-zinc-600 bg-zinc-700 px-3 py-2 text-center text-lg tracking-widest text-zinc-100 placeholder-zinc-500 focus:outline-none"
              autoFocus
              disabled={loading}
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={backToIpStep}
                className="rounded-md border border-zinc-600 bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-600"
                disabled={loading}
              >
                Back
              </button>
              <button
                type="button"
                disabled={loading || codeInput.replace(/\D/g, "").length !== 6}
                onClick={submitCode}
                className="rounded-md bg-blue-glow px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Pairing…" : "Pair"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="ip-connect-title" className="text-lg font-semibold text-zinc-100">
              Connect to robot
            </h2>
            <p className="mt-1 text-sm text-zinc-400">Enter a name and IP address, or find the IP with Bluetooth.</p>
            {error && (
              <div
                className="mt-4 rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-200"
                role="alert"
              >
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={handleFindIPWithBluetooth}
              disabled={loading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-zinc-600 bg-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Connecting…" : "Find IP with Bluetooth"}
            </button>
            <div className="mt-4 border-t border-zinc-700 pt-4">
              <p className="text-sm font-medium text-zinc-300">Or enter IP manually</p>
              <label className="mt-4 block text-sm font-medium text-zinc-300">Device name</label>
              <input
                type="text"
                value={deviceNameInput}
                onChange={(e) => {
                  setDeviceNameInput(e.target.value);
                  setError(null);
                }}
                placeholder="Robot"
                className="focus-blue-glow mt-1 w-full rounded-md border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
                autoFocus
                disabled={loading}
              />
              <label className="mt-4 block text-sm font-medium text-zinc-300">IP address</label>
              <input
                type="text"
                value={ipAddressInput}
                onChange={(e) => {
                  setIpAddressInput(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. 192.168.1.1"
                className="focus-blue-glow mt-1 w-full rounded-md border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
                disabled={loading}
              />
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-md border border-zinc-600 bg-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-600"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading || !ipAddressInput.trim()}
                  onClick={handleConnect}
                  className="rounded-md bg-blue-glow px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Connecting…" : "Connect"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
