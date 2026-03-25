"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { ConnectionStatusWidget } from "@/components/ConnectionStatusWidget";
import { ProjectStatusWidget } from "@/components/ProjectStatusWidget";
import { useIsAuthenticated } from "@azure/msal-react";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const isAuthenticated = useIsAuthenticated();

  // Middleware handles missing token; only redirect unverified users here
  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
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
        <div className="flex flex-wrap gap-4">
          <ConnectionStatusWidget />
          <ProjectStatusWidget />
        </div>
      </main>
    </div>
  );
}
