"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function HomePage() {
  const router = useRouter();
  const { user, token, loading, logout } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace("/authenticate");
      return;
    }
    if (user && !user.email_verified) {
      router.replace("/authenticate");
    }
  }, [loading, token, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <h1 className="text-lg font-semibold">Driver Station</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">
            {user.first_name} {user.last_name} ({user.email})
          </span>
          <button
            type="button"
            onClick={logout}
            className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-600"
          >
            Logout
          </button>
        </div>
      </header>
      <main className="p-6">
        <p className="text-zinc-400">Driver Station for controlling robot running ZaraOS.</p>
      </main>
    </div>
  );
}
