"use client";

import { useState } from "react";
import { useConnection } from "@/contexts/ConnectionContext";
import { connectBLEAndGetIP } from "@/lib/ble-get-ip";

type IpConnectModalProps = {
  open: boolean;
  onClose: () => void;
};

export function IpConnectModal({ open, onClose }: IpConnectModalProps) {
  const { connect } = useConnection();
  const [deviceNameInput, setDeviceNameInput] = useState("Robot");
  const [ipAddressInput, setIpAddressInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleClose = () => {
    setError(null);
    onClose();
  };

  /**
   * Single path for connecting with a name and IP: POST to robot auth/pair/start,
   * then persist connection and close. Used by both manual entry and Bluetooth discovery.
   */
  const submitConnection = async (name: string, ip: string) => {
    const trimmedName = name.trim() || "Robot";
    const trimmedIp = ip.trim();
    if (!trimmedIp) return;
    setError(null);
    setLoading(true);
    try {
      const baseUrl = `http://${trimmedIp}:8080`;
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
      connect(trimmedName, trimmedIp);
      handleClose();
    } catch {
      setError(
        "Could not reach the robot. Check the IP address and that the robot is powered on and on the same network."
      );
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
      </div>
    </div>
  );
}
