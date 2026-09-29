"use client";

import { Header } from "@/components/Header";
import RobotTerminal from "@/components/SSHTerminal";
import { useConnection } from "@/contexts/ConnectionContext";
import { signedFetch } from "@/lib/robot-api";

export default function ConsolePage() {
  const { connection } = useConnection();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header />
      <main className="p-6">
        {connection ? (
          <RobotTerminal
            robotUrl={`http://${connection.ip}:8080`}
            signedFetch={(url, init) => signedFetch(connection, /* method */ init?.method ?? "GET", new URL(url).pathname, init?.body as string | undefined)}
          />
        ) : (
          <p className="text-zinc-400">No robot connected. Use the Connect button in the header.</p>
        )}
      </main>
    </div>
  );
}
