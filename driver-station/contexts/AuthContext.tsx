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

type AuthContextValue = {
    user: AccountInfo | null;
    loading: boolean;
    login: () => void;
    logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const { instance, accounts, inProgress } = useMsal();
    const router = useRouter();

    const user = useMemo<AccountInfo | null>(
        () => (accounts.length > 0 ? accounts[0] : null),
        [accounts],
    );
    const loading = inProgress !== "none";

    const login = async () => {
        await instance.loginRedirect({
            scopes: ["User.Read"],
        });
    };

    const logout = async () => {
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