"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useConnection } from "@/contexts/ConnectionContext";
import { useProject } from "@/contexts/ProjectContext";
import { Header } from "@/components/Header";
import {
  getCombinedReleases,
  getReleaseGroupName,
  groupReleasesByTitle,
  type ReleaseGroup,
  type ReleaseWithSource,
} from "@/lib/api";
import { getInstances, deleteInstance, type RobotAppInstance } from "@/lib/robot-api";

/** Prevents duplicate Core/Apps fetches when React Strict Mode double-invokes the effect. */
let releasesFetchInFlight = false;

/** Prevents duplicate GET /instances when React Strict Mode double-invokes the effect. */
let instancesFetchInFlight = false;

/** Normalize group/release name to match robot instance app slug (e.g. "ROS2 Nav" → "ros2-nav"). */
function groupNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function VersionMenu({
  group,
  onSelectVersion,
  activeProjectUrls,
  isVersionRunningOnRobot,
  open,
  onToggle,
  onClose,
}: {
  group: ReleaseGroup;
  onSelectVersion: (release: ReleaseWithSource) => void;
  activeProjectUrls: Set<string>;
  isVersionRunningOnRobot: (tagName: string) => boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="cursor-pointer rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
        aria-label="Select version"
        aria-expanded={open}
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="6" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="18" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-lg">
          {group.versions.map((r) => {
            const isActive = activeProjectUrls.has(r.html_url) || isVersionRunningOnRobot(r.tag_name);
            return (
              <button
                key={`${r.source}-${r.id}`}
                type="button"
                onClick={() => {
                  onSelectVersion(r);
                  onClose();
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700"
              >
                <span>
                  {r.tag_name}
                  {group.versions.some((v) => v.tag_name === r.tag_name && v.source !== r.source) && (
                    <span className="ml-1 text-zinc-500">({r.source})</span>
                  )}
                </span>
                {isActive && (
                  <svg className="h-4 w-4 shrink-0 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type RunningInstance = { id: string; app: string; version: string };

export default function AppsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { connection } = useConnection();
  const { activeProjects, addActiveProject, removeActiveProject, isActive } = useProject();
  const [groups, setGroups] = useState<ReleaseGroup[]>([]);
  const [loadingReleases, setLoadingReleases] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuGroup, setOpenMenuGroup] = useState<string | null>(null);
  const [runningInstances, setRunningInstances] = useState<RunningInstance[]>([]);
  const [stoppingInstanceId, setStoppingInstanceId] = useState<string | null>(null);

  const activeProjectUrls = new Set(activeProjects.map((p) => p.url));

  // Fetch GET /instances when robot is connected, then every 60s
  useEffect(() => {
    if (!connection?.token) {
      setRunningInstances([]);
      return;
    }
    const fetchInstances = (isInitial = false) => {
      if (isInitial && instancesFetchInFlight) return;
      if (isInitial) instancesFetchInFlight = true;
      getInstances(connection)
        .then((data) => {
          const running = data.instances
            .filter((i: RobotAppInstance) => i.state === "running")
            .map((i: RobotAppInstance) => ({ id: i.id, app: i.app, version: i.version }));
          setRunningInstances(running);
        })
        .catch(() => setRunningInstances([]))
        .finally(() => {
          if (isInitial) instancesFetchInFlight = false;
        });
    };
    fetchInstances(true);
    const interval = setInterval(() => fetchInstances(false), 60_000);
    return () => clearInterval(interval);
  }, [connection]);

  useEffect(() => {
    if (loading) return;
    if (user && !user.email_verified) {
      router.replace("/authenticate");
    }
  }, [loading, user, router]);

  useEffect(() => {
    // Guard against double-invocation in React Strict Mode (dev) so we don't call Core/Apps twice
    if (releasesFetchInFlight) return;
    releasesFetchInFlight = true;
    setLoadingReleases(true);
    setError(null);
    getCombinedReleases()
      .then((releases) => {
        setGroups(groupReleasesByTitle(releases));
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load releases");
        setGroups([]);
      })
      .finally(() => {
        setLoadingReleases(false);
        releasesFetchInFlight = false;
      });
  }, []);

  // Running instances not already represented in user's active list (by app+version)
  const runningOnly = runningInstances.filter(
    (ri) =>
      !activeProjects.some(
        (p) =>
          p.version === ri.version &&
          (groupNameToSlug(p.name) === ri.app || p.name === ri.app)
      )
  );

  const isVersionRunningOnRobot = (groupName: string, tagName: string) =>
    runningInstances.some(
      (ri) =>
        ri.version === tagName &&
        (groupNameToSlug(groupName) === ri.app || groupName === ri.app)
    );

  const handleSelectVersion = (release: ReleaseWithSource) => {
    addActiveProject({
      url: release.html_url,
      name: getReleaseGroupName(release),
      version: release.tag_name,
    });
  };

  const handleStopInstance = (ri: RunningInstance) => {
    if (!connection?.token || stoppingInstanceId) return;
    setStoppingInstanceId(ri.id);
    deleteInstance(connection, ri.id)
      .then(() => {
        return getInstances(connection).then((data) => {
          const running = data.instances
            .filter((i: RobotAppInstance) => i.state === "running")
            .map((i: RobotAppInstance) => ({ id: i.id, app: i.app, version: i.version }));
          setRunningInstances(running);
        });
      })
      .catch(() => {})
      .finally(() => setStoppingInstanceId(null));
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header />
      <main className="p-6">
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-medium text-zinc-200">Active</h2>
          {activeProjects.length === 0 && runningOnly.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-6 text-center text-sm text-zinc-400">
              No active apps. Select an app from Available to add it here, or connect to a robot to see running apps.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeProjects.map((project) => (
                <div
                  key={project.url}
                  className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-4 transition-all"
                  style={{ boxShadow: "var(--blue-outline)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-zinc-100">{project.name}</div>
                    <div className="mt-0.5 font-mono text-sm text-zinc-400">{project.version}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeActiveProject(project.url)}
                    className="cursor-pointer rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-red-300"
                    aria-label="Remove from active"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              {runningOnly.map((ri) => {
                const isStopping = stoppingInstanceId === ri.id;
                return (
                  <div
                    key={ri.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-4 transition-all"
                    style={{ boxShadow: "var(--blue-outline)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-zinc-100">{ri.app}</div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="font-mono text-sm text-zinc-400">{ri.version}</span>
                        <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-400">on robot</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStopInstance(ri)}
                      disabled={isStopping}
                      className="cursor-pointer rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-70"
                      aria-label="Stop on robot"
                    >
                      {isStopping ? (
                        <svg
                          className="h-5 w-5 animate-spin text-zinc-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          aria-hidden
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeDasharray="24 48"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-medium text-zinc-200">Available</h2>

          {loadingReleases && (
            <div className="flex items-center justify-center py-12 text-zinc-400">
              Loading releases…
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {!loadingReleases && !error && groups.length === 0 && (
            <div className="py-12 text-center text-zinc-400">No releases found.</div>
          )}

          {!loadingReleases && !error && groups.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => (
                <div
                  key={group.groupName}
                  className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-4 transition-all"
                  style={{
                    boxShadow:
                      group.versions.some((v) => isActive(v.html_url)) ||
                      group.versions.some((v) => isVersionRunningOnRobot(group.groupName, v.tag_name))
                        ? "var(--blue-outline)"
                        : "none",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-zinc-100">{group.groupName}</div>
                    <div className="mt-0.5 text-sm text-zinc-400">
                      {group.versions.length} version{group.versions.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <VersionMenu
                    group={group}
                    onSelectVersion={handleSelectVersion}
                    activeProjectUrls={activeProjectUrls}
                    isVersionRunningOnRobot={(tagName) =>
                      isVersionRunningOnRobot(group.groupName, tagName)
                    }
                    open={openMenuGroup === group.groupName}
                    onToggle={() =>
                      setOpenMenuGroup((prev) => (prev === group.groupName ? null : group.groupName))
                    }
                    onClose={() => setOpenMenuGroup(null)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
