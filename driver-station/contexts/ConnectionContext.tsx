"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const CONNECTION_KEY = "driver-station-connection";

export type Connection = {
  name: string;
  ip: string;
};

type ConnectionContextValue = {
  connection: Connection | null;
  connect: (name: string, ip: string) => void;
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

  useEffect(() => {
    setConnectionState(loadFromStorage());
  }, []);

  const connect = useCallback((name: string, ip: string) => {
    const value: Connection = { name, ip };
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
  }, []);

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
