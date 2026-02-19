"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { API_URL } from "@/lib/auth-config";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Verifying...");
  const [error, setError] = useState(false);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setMessage("No verification token provided");
      setError(true);
      return;
    }
    fetch(`${API_URL}/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data: { message?: string; error?: string }) => {
        if (data.message) setMessage(data.message);
        else if (data.error) {
          setMessage(data.error);
          setError(true);
        }
      })
      .catch(() => {
        setMessage("Verification failed. Please try again.");
        setError(true);
      });
  }, [searchParams]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <h1
        className={`text-xl font-medium ${error ? "text-red-400" : "text-cyan-400"}`}
      >
        {message}
      </h1>
      {!error && message.toLowerCase().includes("success") && (
        <p className="mt-4">
          <Link href="/authenticate" className="text-cyan-400 hover:underline">
            Return to login
          </Link>
        </p>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-cyan-400">
          Verifying...
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
