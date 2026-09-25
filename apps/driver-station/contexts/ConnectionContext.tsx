"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { revokeRobotSession } from "@/lib/robot-api";

const CONNECTION_KEY = "driver-station-connection";

export type Connection = {
  name: string;
  ip: string;
  /** Robot pairing token (HMAC-derived); used to sign requests to the robot API. */
  token?: string;
  /** Local dev: connected via GET /health on localhost without pairing. */
  devMode?: boolean;
};

type ConnectionContextValue = {
  connection: Connection | null;
  connect: (name: string, ip: string, token?: string, opts?: { devMode?: boolean }) => void;
  disconnect: () => void;
};

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

function loadFromStorage(): Connection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONNECTION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (
      data &&
      typeof data === "object" &&
      "name" in data &&
      "ip" in data &&
      typeof (data as Connection).name === "string" &&
      typeof (data as Connection).ip === "string"
    ) {
      return data as Connection;
    }
  } catch {
    // ignore
  }
  return null;
}

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [connection, setConnectionState] = useState<Connection | null>(null);

  // Hydrate from localStorage after SSR — must be in useEffect to avoid mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setConnectionState(loadFromStorage()); }, []);

  const connect = useCallback((name: string, ip: string, token?: string, opts?: { devMode?: boolean }) => {
    const value: Connection = {
      name,
      ip,
      ...(token ? { token } : {}),
      ...(opts?.devMode ? { devMode: true } : {}),
    };
    setConnectionState(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(CONNECTION_KEY, JSON.stringify(value));
    }
  }, []);

  const disconnect = useCallback(() => {
    setConnectionState(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(CONNECTION_KEY);
    }
    if (connection?.token) {
      void revokeRobotSession(connection);
    }
  }, [connection]);

  return (
    <ConnectionContext.Provider value={{ connection, connect, disconnect }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnection must be used within ConnectionProvider");
  return ctx;
}
