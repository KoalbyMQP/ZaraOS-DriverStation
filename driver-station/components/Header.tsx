"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";

const BLUE_OUTLINE =
  "0 0 0 1px rgba(59, 130, 246, 0.5), 0 0 20px 2px rgba(59, 130, 246, 0.25), 0 0 40px 4px rgba(59, 130, 246, 0.15)";

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

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { selectedProject, setSelectedProject } = useProject();
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
    }
    if (menuOpen || projectDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen, projectDropdownOpen]);

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
    <header className="relative flex items-center justify-between border-b border-zinc-800 px-6 py-4">
      <div className="flex items-center gap-6">
        <h1 className="text-lg font-semibold">Driver Station</h1>
        <nav className="flex items-center gap-4">
          {navLink("/", "Home")}
          {navLink("/console", "Console")}
          {navLink("/apps", "Apps")}
        </nav>
      </div>
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-4">
        <div className="relative" ref={projectDropdownRef}>
          <button
            type="button"
            onClick={() => setProjectDropdownOpen((o) => !o)}
            className="cursor-pointer rounded-md border border-zinc-800 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
            style={{ boxShadow: BLUE_OUTLINE }}
            aria-expanded={projectDropdownOpen}
          >
            {selectedProject
              ? `Project: ${selectedProject.name} (${selectedProject.version})`
              : "Project: no project selected"}
          </button>
          {projectDropdownOpen && (
            <div className="absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-800 py-2 shadow-lg">
              {selectedProject ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProject(null);
                    setProjectDropdownOpen(false);
                  }}
                  className="w-full cursor-pointer px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700"
                >
                  Deselect project
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setProjectDropdownOpen(false);
                    router.push("/apps");
                  }}
                  className="w-full cursor-pointer px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700"
                >
                  Select project
                </button>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          className="cursor-pointer rounded-md border border-zinc-800 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
          style={{ boxShadow: BLUE_OUTLINE }}
        >
          Connect
        </button>
      </div>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-zinc-100"
          aria-label="Account menu"
          aria-expanded={menuOpen}
        >
          <PersonIcon className="h-5 w-5" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-zinc-700 bg-zinc-800 py-2 shadow-lg">
            <div className="border-b border-zinc-700 px-4 py-3">
              <p className="text-sm font-medium text-zinc-100">
                {user.first_name} {user.last_name}
              </p>
              <p className="mt-0.5 truncate text-sm text-zinc-400">{user.email}</p>
            </div>
            <div className="px-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                className="w-full cursor-pointer rounded bg-zinc-700 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-600"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
