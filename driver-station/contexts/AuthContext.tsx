"use client";

import {
    createContext,
    useContext,
    useMemo,
    type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useMsal } from "@azure/msal-react";
import { AccountInfo } from "@azure/msal-browser";
import { isClientLocalAuthBypassEnabled } from "@/lib/authBypass";

type AuthContextValue = {
    user: AccountInfo | null;
    loading: boolean;
    login: () => void;
    logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const LOCAL_DEV_ACCOUNT: AccountInfo = {
    homeAccountId: "local-dev-home-account-id",
    localAccountId: "local-dev-local-account-id",
    environment: "localhost",
    tenantId: "local-dev-tenant-id",
    username: "local-dev@localhost",
    name: "Local Dev User",
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const { instance, accounts, inProgress } = useMsal();
    const router = useRouter();
    const bypassAuth = isClientLocalAuthBypassEnabled();

    const user = useMemo<AccountInfo | null>(
        () => {
            if (bypassAuth) return LOCAL_DEV_ACCOUNT;
            return accounts.length > 0 ? accounts[0] : null;
        },
        [accounts, bypassAuth],
    );
    const loading = bypassAuth ? false : inProgress !== "none";

    const login = async () => {
        if (bypassAuth) return;
        await instance.loginRedirect({
            scopes: ["User.Read"],
        });
    };

    const logout = async () => {
        if (bypassAuth) {
            router.push("/");
            return;
        }
        await instance.logoutRedirect();
        router.push("/authenticate");
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}