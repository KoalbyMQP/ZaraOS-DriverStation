"use client";

import { useMsal } from "@azure/msal-react";
import { loginRequest } from "@/lib/msalConfig";

export default function AuthenticatePage() {
    const { instance, accounts } = useMsal();

    const login = async () => {
        await instance.loginRedirect(loginRequest);
    };

    const logout = async () => {
        await instance.logoutRedirect();
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
            {!accounts.length ? (
                <button
                    onClick={login}
                    className="rounded bg-blue-500 px-6 py-3"
                >
                    Sign in with Microsoft
                </button>
            ) : (
                <button
                    onClick={logout}
                    className="rounded bg-red-500 px-6 py-3"
                >
                    Logout
                </button>
            )}
        </div>
    );
}