"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/authenticate");
    }
  }, [loading, user, router]);

  // MSAL starts in a loading state on both the server and the first client render.
  // Keep children unmounted until it finishes restoring the account/redirect.
  if (loading || !user) {
    return (
      <div
        role="status"
        className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400"
      >
        Loading...
      </div>
    );
  }

  return children;
}
