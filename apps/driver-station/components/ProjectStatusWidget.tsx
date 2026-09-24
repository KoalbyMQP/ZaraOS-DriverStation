"use client";

import Link from "next/link";
import { useProject } from "@/contexts/ProjectContext";

function FolderIcon({ hasProjects }: { hasProjects: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-8 w-8 shrink-0 ${hasProjects ? "text-blue-glow" : "text-zinc-500"}`}
    >
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

export function ProjectStatusWidget() {
  const { activeProjects } = useProject();
  const hasProjects = activeProjects.length > 0;

  return (
    <div
      className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
      style={hasProjects ? { boxShadow: "var(--blue-outline)" } : undefined}
    >
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 items-center justify-center pt-0.5">
          <FolderIcon hasProjects={hasProjects} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Active projects
          </p>
          {hasProjects ? (
            <ul className="mt-1.5 space-y-1">
              {activeProjects.map((p) => (
                <li key={p.url} className="text-sm font-medium text-zinc-100">
                  {p.name}
                  <span className="ml-2 font-mono text-zinc-400">{p.version}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-sm text-zinc-400">
              No active projects.{" "}
              <Link href="/apps" className="text-blue-400 hover:underline">
                Add from Apps
              </Link>
            </p>
          )}
        </div>
        <div
          className={`h-2 w-2 shrink-0 rounded-full pt-1.5 ${hasProjects ? "bg-blue-glow" : "bg-zinc-600"}`}
          title={hasProjects ? "Active projects" : "No active projects"}
        />
      </div>
    </div>
  );
}
