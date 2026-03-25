"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import RobotTerminal from "@/components/SSHTerminal";
import { useConnection } from "@/contexts/ConnectionContext";
import { signedFetch } from "@/lib/robot-api";

export default function ConsolePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { connection } = useConnection();


  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/authenticate");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Loading...
      </div>
    );
  }

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
