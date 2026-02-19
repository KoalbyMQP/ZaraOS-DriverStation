"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

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
    <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
      <div className="flex items-center gap-6">
        <h1 className="text-lg font-semibold">Driver Station</h1>
        <nav className="flex items-center gap-4">
          {navLink("/", "Home")}
          {navLink("/console", "Console")}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-400">
          {user.first_name} {user.last_name} ({user.email})
        </span>
        <button
          type="button"
          onClick={logout}
          className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-600"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
