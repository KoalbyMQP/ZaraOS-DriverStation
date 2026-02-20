"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  checkEmail,
  login,
  signup,
  forgotPassword,
  authMe,
} from "@/lib/api";
import { AUTH_TOKEN_KEY } from "@/lib/auth-config";
import { useAuth } from "@/contexts/AuthContext";

type AuthState = "start" | "signup" | "login" | "verify-email" | "forgot-password";

export default function AuthenticatePage() {
  const router = useRouter();
  const { setToken } = useAuth();
  const [state, setState] = useState<AuthState>("start");
  const [btnText, setBtnText] = useState("Continue");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [popupShown, setPopupShown] = useState(false);
  const [popupText, setPopupText] = useState("");

  const showMessage = useCallback((text: string) => {
    setPopupText(text);
    setPopupShown(true);
  }, []);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
    if (!token) return;
    authMe()
      .then(({ user }) => {
        if (user?.email_verified) {
          router.push("/");
        }
      })
      .catch(() => {
        if (typeof window !== "undefined") localStorage.removeItem(AUTH_TOKEN_KEY);
      });
  }, [router]);

  const discoverEmail = useCallback(async () => {
    if (!email) {
      showMessage("Please enter your email");
      return;
    }
    try {
      const data = await checkEmail(email);
      setState(data.action as AuthState);
      if (data.action === "signup") setBtnText("Sign up");
      else if (data.action === "login") setBtnText("Login");
      else if (data.action === "sso") showMessage("SSO not available yet");
    } catch (e) {
      showMessage(e instanceof Error ? e.message : "Could not connect to server.");
    }
  }, [email, showMessage]);

  const handleSubmit = useCallback(async () => {
    switch (state) {
      case "start":
        await discoverEmail();
        break;

      case "signup": {
        if (!email || !password || !firstName || !lastName) {
          showMessage("Please fill in all fields");
          return;
        }
        if (password.length < 6) {
          showMessage("Password must be at least 6 characters");
          return;
        }
        try {
          await signup({ email, password, firstName, lastName });
          setState("verify-email");
          setBtnText("Back to login");
          showMessage(
            "Account created! Please check your email to verify your account."
          );
        } catch (e) {
          showMessage(e instanceof Error ? e.message : "Signup failed");
        }
        break;
      }

      case "login": {
        if (!email || !password) {
          showMessage("Please enter email and password");
          return;
        }
        try {
          const data = await login(email, password);
          setToken(data.token);
          router.push("/");
        } catch (e: unknown) {
          const err = e as Error & { emailVerified?: boolean };
          if (err.emailVerified === false) {
            setState("verify-email");
            setBtnText("Back to login");
            showMessage("Please verify your email before logging in. Check your inbox.");
          } else {
            showMessage(err instanceof Error ? err.message : "Login failed");
          }
        }
        break;
      }

      case "verify-email":
        setState("start");
        setBtnText("Continue");
        setPassword("");
        break;

      case "forgot-password": {
        if (!email) {
          showMessage("Please enter your email");
          return;
        }
        try {
          const data = await forgotPassword(email);
          showMessage(data.message ?? "Password reset email sent!");
          setState("start");
          setBtnText("Continue");
        } catch {
          showMessage("An error occurred. Please try again.");
        }
        break;
      }

      default:
        break;
    }
  }, [state, email, password, firstName, lastName, discoverEmail, showMessage, setToken, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleSubmit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleSubmit]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 py-12 text-zinc-100">
      <h1 className="mb-8 text-2xl font-semibold">Welcome, user</h1>
      <div className="mx-auto w-full max-w-[300px]">
        {state !== "verify-email" && (
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-3 w-full rounded border bg-zinc-700 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none"
            style={{
              boxShadow: "var(--blue-outline)",
              borderColor: "rgb(var(--blue-glow))",
            }}
          />
        )}

        {(state === "signup" || state === "login") && (
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-3 w-full rounded border bg-zinc-700 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none"
            style={{
              boxShadow: "var(--blue-outline)",
              borderColor: "rgb(var(--blue-glow))",
            }}
          />
        )}

        {state === "signup" && (
          <>
            <input
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="focus-blue-glow mb-3 w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="focus-blue-glow mb-3 w-full rounded border border-zinc-600 bg-zinc-700 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none"
            />
          </>
        )}

        {state === "verify-email" && (
          <div className="mb-4 text-center">
            <h2 className="text-lg font-medium">Check your inbox!</h2>
            <p className="mt-2 text-sm italic text-zinc-400">
              We sent a verification email to {email}
            </p>
            <p className="mt-2 text-sm text-zinc-500">
              Click the link in the email to verify your account, then come back
              and log in.
            </p>
          </div>
        )}

        {state === "login" && (
          <div className="mb-3 text-center">
            <button
              type="button"
              onClick={() => {
                setState("forgot-password");
                setBtnText("Send reset link");
              }}
              className="text-sm text-blue-glow hover:underline"
            >
              Forgot password?
            </button>
          </div>
        )}

        <div className="mt-4 text-center">
          {(state === "login" ||
            state === "signup" ||
            state === "forgot-password") && (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => {
                  setState("start");
                  setBtnText("Continue");
                  setPassword("");
                  setFirstName("");
                  setLastName("");
                }}
                className="text-sm text-blue-glow hover:underline"
              >
                ← Back
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => handleSubmit()}
            className="rounded bg-blue-glow px-6 py-2 font-medium text-white transition-transform hover:scale-105"
            style={{ boxShadow: "var(--blue-outline)" }}
          >
            {btnText}
          </button>
        </div>

        {popupShown && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            role="dialog"
            aria-modal="true"
          >
            <div className="mx-4 max-w-sm rounded-lg bg-zinc-800 p-6 shadow-xl">
              <p className="text-zinc-100">{popupText}</p>
              <button
                type="button"
                onClick={() => setPopupShown(false)}
                className="mt-4 w-full rounded bg-blue-glow py-2 font-medium text-white transition-transform hover:scale-105"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
