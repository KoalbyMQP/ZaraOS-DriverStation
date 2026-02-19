"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  AUTH_TOKEN_KEY,
} from "@/lib/auth-config";
import { authMe, type User } from "@/lib/api";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  setToken: (token: string | null) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const setToken = useCallback((t: string | null) => {
    if (typeof window === "undefined") return;
    if (t) {
      localStorage.setItem(AUTH_TOKEN_KEY, t);
      const secure = window.location?.protocol === "https:" ? "; secure" : "";
      document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(t)}; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; samesite=lax${secure}`;
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0`;
    }
    setTokenState(t);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (typeof window === "undefined") return;
    const t = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!t) {
      setUser(null);
      setTokenState(null);
      setLoading(false);
      return;
    }
    try {
      const { user: u } = await authMe();
      setUser(u);
      setTokenState(t);
    } catch {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0`;
      setUser(null);
      setTokenState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Hydrate token from localStorage on mount and sync to cookie (so middleware allows future requests)
  useEffect(() => {
    const t = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!t) {
      setLoading(false);
      return;
    }
    setTokenState(t);
    const secure = typeof window !== "undefined" && window.location?.protocol === "https:" ? "; secure" : "";
    document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(t)}; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; samesite=lax${secure}`;
  }, []);

  // Whenever we have a token (initial load or after login), fetch user; clear user when token is gone
  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    authMe()
      .then(({ user: u }) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0`;
          setTokenState(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    router.push("/authenticate");
  }, [setToken, router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        setToken,
        logout,
        refreshUser,
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
