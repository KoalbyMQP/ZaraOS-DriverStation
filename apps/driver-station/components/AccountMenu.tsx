"use client";

import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon, UserIcon } from "@repo/ui/icons";
import { useAuth } from "@/contexts/AuthContext";

// Keep the original account menu during the shell migration.
export function AccountMenu() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-zinc-100"
          aria-label="Account menu"
          aria-expanded={menuOpen}
        >
          <HugeiconsIcon icon={UserIcon} className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      {menuOpen && (
        <div className="absolute top-full right-0 z-50 mt-2 w-56 rounded-lg border border-zinc-700 bg-zinc-800 py-2 shadow-lg">
          <div className="border-b border-zinc-700 px-4 py-3">
            <p className="text-sm font-medium text-zinc-100">{user.name ?? user.username}</p>
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
  );
}
