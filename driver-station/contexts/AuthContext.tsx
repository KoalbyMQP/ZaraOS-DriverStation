"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
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
    const { instance, accounts } = useMsal();
    const [user, setUser] = useState<AccountInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (accounts.length > 0) {
            setUser(accounts[0]);
        } else {
            setUser(null);
        }
        setLoading(false);
    }, [accounts]);

    const login = async () => {
        await instance.loginRedirect({
            scopes: ["User.Read"],
        });
    };

    const logout = async () => {
        await instance.logoutRedirect();
        setUser(null);
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