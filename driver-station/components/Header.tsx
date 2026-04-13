"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useConnection } from "@/contexts/ConnectionContext";
import { useTheme } from "@/contexts/ThemeContext";
import { IpConnectModal } from "@/components/IpConnectModal";

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 1 0-16 0" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { connection, connect, disconnect } = useConnection();
  const { theme, toggleTheme, darkReaderDetected } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [connectDropdownOpen, setConnectDropdownOpen] = useState(false);
  const [ipConnectModalOpen, setIpConnectModalOpen] = useState(false);
  const [devModeLoading, setDevModeLoading] = useState(false);
  const [devModeError, setDevModeError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const connectDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (connectDropdownRef.current && !connectDropdownRef.current.contains(e.target as Node)) {
        setConnectDropdownOpen(false);
      }
    }
    if (menuOpen || connectDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen, connectDropdownOpen]);

  if (!user) return null;

  const DEV_HEALTH_URL = "http://127.0.0.1:8080/health";

  const handleDevMode = async () => {
    setDevModeError(null);
    setDevModeLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(DEV_HEALTH_URL, { method: "GET", signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) {
        setDevModeError(
          `Health check failed (${res.status}). Make sure to start ZaraOS on localhost and see setup instructions: https://github.com/KoalbyMQP/ZaraOS`,
        );
        return;
      }
      connect("Dev Mode", "127.0.0.1", undefined, { devMode: true });
    } catch {
      setDevModeError(
        "Could not reach localhost:8080. Start ZaraOS on localhost and see setup instructions: https://github.com/KoalbyMQP/ZaraOS",
      );
    } finally {
      setDevModeLoading(false);
    }
  };

  const navLink = (href: string, label: string) => {
    const isActive = pathname === href;
    return (
      <Link
        href={href}
        className={`text-sm font-medium ${isActive ? "text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="relative flex items-center justify-between border-b border-zinc-800 px-6 py-4">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-lg font-semibold text-zinc-100 hover:text-zinc-200">
          Driver Station
        </Link>
        <nav className="flex items-center gap-4">
          {navLink("/console", "Console")}
          {navLink("/apps", "Apps")}
        </nav>
      </div>
      <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <div className="relative" ref={connectDropdownRef}>
            <button
              type="button"
            onClick={() => {
              if (connection) setConnectDropdownOpen((o) => !o);
              else {
                setDevModeError(null);
                setIpConnectModalOpen(true);
              }
            }}
              className="cursor-pointer rounded-md border border-zinc-800 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
              style={{ boxShadow: "var(--blue-outline)" }}
              aria-expanded={connectDropdownOpen}
            >
              {connection
                ? connection.devMode
                  ? "Connected in Dev Mode"
                  : `Connected: ${connection.name}`
                : "Connect to Robot"}
            </button>
            {connectDropdownOpen && connection && (
              <div className="absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-800 py-2 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    disconnect();
                    setConnectDropdownOpen(false);
                  }}
                  className="w-full cursor-pointer px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
          {!connection && (
            <button
              type="button"
              onClick={handleDevMode}
              disabled={devModeLoading}
              className="cursor-pointer rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {devModeLoading ? "Checking…" : "Dev Mode"}
            </button>
          )}
        </div>
        {devModeError && (
          <p className="max-w-sm text-center text-xs text-red-400" role="alert">
            {devModeError}
          </p>
        )}
      </div>
      <div className="relative" ref={menuRef}>
        <div className="flex items-center gap-3">
          {darkReaderDetected && (
            <span
              className="darkreader-badge rounded-full border px-2 py-1 text-xs font-medium"
              title="Dark Reader is active and may override the in-app theme."
            >
              Dark Reader
            </span>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle-button flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
            <span className="hidden sm:inline">{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-zinc-100"
            aria-label="Account menu"
            aria-expanded={menuOpen}
          >
            <PersonIcon className="h-5 w-5" />
          </button>
        </div>
        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-zinc-700 bg-zinc-800 py-2 shadow-lg">
            <div className="border-b border-zinc-700 px-4 py-3">
              <p className="text-sm font-medium text-zinc-100">
                {user.name ?? user.username}
              </p>
              <p className="mt-0.5 truncate text-sm text-zinc-400">{user.username}</p>
            </div>
            <div className="px-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="w-full cursor-pointer rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-left text-sm text-red-200 transition-colors hover:bg-red-900/50 hover:text-red-100"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>

      <IpConnectModal open={ipConnectModalOpen} onClose={() => setIpConnectModalOpen(false)} />
    </header>
  );
}
