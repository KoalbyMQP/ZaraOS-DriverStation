"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "@/lib/msalConfig";
import { isClientLocalAuthBypassEnabled } from "@/lib/authBypass";

export default function AuthenticatePage() {
    const { instance, accounts, inProgress } = useMsal();
    const router = useRouter();
    const loginTriggered = useRef(false);
    const bypassAuth = isClientLocalAuthBypassEnabled();

    // If bypass is enabled or user is already logged in, redirect straight to dashboard.
    useEffect(() => {
        if (bypassAuth || accounts.length > 0) {
            router.replace("/");
        }
    }, [accounts, bypassAuth, router]);

    // Auto-launch login when an unauthenticated user lands here
    useEffect(() => {
        if (
            !bypassAuth &&
            accounts.length === 0 &&
            inProgress === InteractionStatus.None &&
            !loginTriggered.current
        ) {
            loginTriggered.current = true;
            instance.loginRedirect(loginRequest);
        }
    }, [accounts, bypassAuth, inProgress, instance]);

    // Show a brief loading state while MSAL initialises or redirects
    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
            <p className="text-zinc-400">Redirecting to sign-in…</p>
        </div>
    );
}