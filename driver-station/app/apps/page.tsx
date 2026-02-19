"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";

const BLUE_OUTLINE =
  "0 0 0 1px rgba(59, 130, 246, 0.5), 0 0 20px 2px rgba(59, 130, 246, 0.25), 0 0 40px 4px rgba(59, 130, 246, 0.15)";

const CARDS = ["Core", "Apps", "Testing"] as const;

export default function AppsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user && !user.email_verified) {
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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((label) => (
            <div
              key={label}
              className="group cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900/80 px-6 py-8 text-center transition-all duration-200 ease-out hover:scale-[1.03] hover:border-transparent"
              style={{
                boxShadow: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = BLUE_OUTLINE;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <span className="text-lg font-medium text-zinc-200 group-hover:text-zinc-100">
                {label}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
