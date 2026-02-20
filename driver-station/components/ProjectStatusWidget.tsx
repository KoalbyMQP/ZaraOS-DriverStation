"use client";

import { useProject } from "@/contexts/ProjectContext";

function FolderIcon({ hasProject }: { hasProject: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-8 w-8 shrink-0 ${hasProject ? "text-blue-glow" : "text-zinc-500"}`}
    >
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

export function ProjectStatusWidget() {
  const { selectedProject } = useProject();
  const hasProject = selectedProject !== null;

  return (
    <div
      className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
      style={hasProject ? { boxShadow: "var(--blue-outline)" } : undefined}
    >
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center justify-center">
          <FolderIcon hasProject={hasProject} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Selected project
          </p>
          {hasProject ? (
            <p className="truncate text-sm font-medium text-zinc-100">
              {selectedProject!.name}
              <span className="ml-2 font-mono text-zinc-400">{selectedProject!.version}</span>
            </p>
          ) : (
            <p className="text-sm text-zinc-400">No project selected</p>
          )}
        </div>
        <div
          className={`h-2 w-2 shrink-0 rounded-full ${hasProject ? "bg-blue-glow" : "bg-zinc-600"}`}
          title={hasProject ? "Project selected" : "No project"}
        />
      </div>
    </div>
  );
}
