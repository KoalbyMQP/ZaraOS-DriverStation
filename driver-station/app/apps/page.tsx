"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useConnection } from "@/contexts/ConnectionContext";
import { useProject } from "@/contexts/ProjectContext";
import { Header } from "@/components/Header";
import { LogViewer } from "@/components/LogViewer";
import {
  getCombinedReleases,
  getReleaseChannel,
  getComponentsReleases,
  getReleaseGroupName,
  groupReleasesByTitle,
  type ReleaseChannel,
  type ReleaseGroup,
  type ReleaseWithSource,
} from "@/lib/api";
import {
  getInstances,
  getInstance,
  createInstance,
  deleteInstance,
  getImages,
  isLocalRobotHost,
  type LocalContainerImage,
  type RobotAppInstance,
} from "@/lib/robot-api";

/** Prevents duplicate Core/Apps fetches when React Strict Mode double-invokes the effect. */
let releasesFetchInFlight = false;

/** Prevents duplicate GET /instances when React Strict Mode double-invokes the effect. */
let instancesFetchInFlight = false;

/** One row per runnable (repository, tag); untagged images use an empty tag and no Run. */
function buildLocalRunRows(images: LocalContainerImage[]): {
  repository: string;
  tag: string;
  img: LocalContainerImage;
}[] {
  const seen = new Set<string>();
  const rows: { repository: string; tag: string; img: LocalContainerImage }[] = [];
  for (const img of images) {
    const tagList = img.tags.length > 0 ? img.tags : [""];
    for (const tag of tagList) {
      const key = `${img.repository}:${tag}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ repository: img.repository, tag, img });
    }
  }
  rows.sort((a, b) => {
    const c = a.repository.localeCompare(b.repository);
    return c !== 0 ? c : a.tag.localeCompare(b.tag);
  });
  return rows;
}

/** Normalize group/release name to match robot instance app slug (e.g. "ROS2 Nav" → "ros2-nav"). */
function groupNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function repoNameFromOwnerRepo(ownerRepo: string): string {
  const [, repo] = ownerRepo.split("/");
  return repo || ownerRepo;
}

/** Stable id for Active list / isActive when starting apps from local images (not a fetchable URL). */
function localProjectUrl(repository: string, tag: string): string {
  return `local:${encodeURIComponent(repository)}:${encodeURIComponent(tag)}`;
}

function localAppSlugFromRepository(repository: string): string {
  return groupNameToSlug(repoNameFromOwnerRepo(repository));
}

function uniqueReposForGroup(group: ReleaseGroup): string[] {
  return Array.from(new Set(group.versions.map((v) => repoNameFromOwnerRepo(v.repo)))).sort((a, b) =>
    a.localeCompare(b)
  );
}

const RELEASE_CHANNEL_LABELS: Record<ReleaseChannel, string> = {
  alpha: "Alpha",
  beta: "Beta",
  rc: "RC",
  preview: "Preview",
  nightly: "Nightly",
  canary: "Canary",
  prerelease: "Prerelease",
};

const RELEASE_CHANNEL_BADGE_CLASSES: Record<ReleaseChannel, string> = {
  alpha: "bg-amber-500/15 text-amber-200 ring-1 ring-inset ring-amber-400/20",
  beta: "bg-sky-500/15 text-sky-200 ring-1 ring-inset ring-sky-400/20",
  rc: "bg-violet-500/15 text-violet-200 ring-1 ring-inset ring-violet-400/20",
  preview: "bg-cyan-500/15 text-cyan-200 ring-1 ring-inset ring-cyan-400/20",
  nightly: "bg-indigo-500/15 text-indigo-200 ring-1 ring-inset ring-indigo-400/20",
  canary: "bg-lime-500/15 text-lime-200 ring-1 ring-inset ring-lime-400/20",
  prerelease: "bg-zinc-700 text-zinc-200 ring-1 ring-inset ring-zinc-600",
};

function getCommonReleaseChannels(versions: ReleaseWithSource[]): ReleaseChannel[] {
  const channels = Array.from(
    new Set(
      versions
        .map((version) => getReleaseChannel(version))
        .filter((channel): channel is ReleaseChannel => channel !== null)
    )
  );

  return channels.length === 1 ? channels : [];
}

function ReleaseTag({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs ${className}`}>
      {label}
    </span>
  );
}

function VersionMenu({
  group,
  appSlug,
  onSelectVersion,
  activeProjectUrls,
  isVersionRunningOnRobot,
  open,
  onToggle,
  onClose,
}: {
  group: ReleaseGroup;
  appSlug: string;
  onSelectVersion: (release: ReleaseWithSource, appSlug: string) => void;
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
            const releaseChannel = getReleaseChannel(r);
            return (
              <button
                key={`${r.source}-${r.id}`}
                type="button"
                onClick={() => {
                  onSelectVersion(r, appSlug);
                  onClose();
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">
                    {r.tag_name}
                  </span>
                  {releaseChannel && (
                    <ReleaseTag
                      label={RELEASE_CHANNEL_LABELS[releaseChannel]}
                      className={RELEASE_CHANNEL_BADGE_CLASSES[releaseChannel]}
                    />
                  )}
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

type InstanceState = "running" | "starting" | "stopping";

type Instance = {
  id: string;
  app: string;
  version: string;
  state: InstanceState;
  /** When state is "starting": used to add to activeProjects once running */
  displayName?: string;
  projectUrl?: string;
};

/** First occurrence wins — avoids duplicate React keys if GET /instances repeats an id. */
function dedupeInstancesById(instances: Instance[]): Instance[] {
  const seen = new Set<string>();
  const out: Instance[] = [];
  for (const inst of instances) {
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);
    out.push(inst);
  }
  return out;
}

export default function AppsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { connection } = useConnection();
  const { activeProjects, addActiveProject, removeActiveProject, isActive } = useProject();
  const [availableGroups, setAvailableGroups] = useState<ReleaseGroup[]>([]);
  const [componentGroups, setComponentGroups] = useState<ReleaseGroup[]>([]);
  const [loadingAvailableReleases, setLoadingAvailableReleases] = useState(true);
  const [loadingComponentReleases, setLoadingComponentReleases] = useState(true);
  const [availableError, setAvailableError] = useState<string | null>(null);
  const [componentsError, setComponentsError] = useState<string | null>(null);
  const [openMenuGroup, setOpenMenuGroup] = useState<string | null>(null);
  /** Single source of truth for all instance states (running, starting, stopping). */
  const [instances, setInstances] = useState<Instance[]>([]);
  const [startError, setStartError] = useState<string | null>(null);
  const [logInstanceId, setLogInstanceId] = useState<string | null>(null);
  const [localImages, setLocalImages] = useState<LocalContainerImage[]>([]);
  const [loadingLocalImages, setLoadingLocalImages] = useState(false);
  const [localImagesError, setLocalImagesError] = useState<string | null>(null);

  const activeProjectUrls = new Set(activeProjects.map((p) => p.url));

  const setInstanceState = (id: string, state: InstanceState, extra?: { displayName?: string; projectUrl?: string }) => {
    setInstances((prev) =>
      prev.map((i) => (i.id === id ? { ...i, state, ...extra } : i))
    );
  };

  const removeInstance = (id: string) => {
    setInstances((prev) => prev.filter((i) => i.id !== id));
    setLogInstanceId((prev) => (prev === id ? null : prev));
  };

  // Fetch GET /instances when robot is connected, then every 60s
  useEffect(() => {
    if (
      !connection ||
      (!connection.token && !isLocalRobotHost(connection))
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInstances([]);
      return;
    }
    const fetchInstances = (isInitial = false) => {
      if (isInitial && instancesFetchInFlight) return;
      if (isInitial) instancesFetchInFlight = true;
      getInstances(connection)
        .then((data) => {
          const apiList = data.instances
            .filter(
              (i: RobotAppInstance) => i.state === "running" || i.state === "starting"
            )
            .map((i: RobotAppInstance) => ({
              id: i.id,
              app: i.app,
              version: i.version,
              state: i.state as InstanceState,
            }));
          setInstances((prev) => {
            const stoppingIds = new Set(
              prev.filter((p) => p.state === "stopping").map((p) => p.id)
            );
            const apiIds = new Set(apiList.map((a) => a.id));
            const merged = apiList.map((api) =>
              stoppingIds.has(api.id) ? { ...api, state: "stopping" as const } : api
            );
            const localStarting = prev.filter(
              (p) => p.state === "starting" && !apiIds.has(p.id)
            );
            return dedupeInstancesById([...merged, ...localStarting]);
          });
        })
        .catch(() => setInstances([]))
        .finally(() => {
          if (isInitial) instancesFetchInFlight = false;
        });
    };
    fetchInstances(true);
    const interval = setInterval(() => fetchInstances(false), 60_000);
    return () => clearInterval(interval);
  }, [connection]);

  useEffect(() => {
    if (!connection?.devMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalImages([]);
      setLocalImagesError(null);
      setLoadingLocalImages(false);
      return;
    }
    let cancelled = false;
    const c = connection;
    const fetchLocalImages = (isInitial: boolean) => {
      if (isInitial) {
        setLoadingLocalImages(true);
        setLocalImagesError(null);
      }
      getImages(c)
        .then((data) => {
          if (cancelled) return;
          setLocalImages(Array.isArray(data.images) ? data.images : []);
          setLocalImagesError(null);
        })
        .catch((e) => {
          if (cancelled) return;
          setLocalImages([]);
          setLocalImagesError(e instanceof Error ? e.message : "Failed to load local images");
        })
        .finally(() => {
          if (!cancelled && isInitial) setLoadingLocalImages(false);
        });
    };
    fetchLocalImages(true);
    const interval = setInterval(() => fetchLocalImages(false), 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [connection]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/authenticate");
    }
  }, [loading, user, router]);

  useEffect(() => {
    // Guard against double-invocation in React Strict Mode (dev) so we don't call release endpoints twice
    if (releasesFetchInFlight) return;
    releasesFetchInFlight = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingAvailableReleases(true);
    setLoadingComponentReleases(true);
    setAvailableError(null);
    setComponentsError(null);
    Promise.allSettled([getCombinedReleases(), getComponentsReleases()])
      .then(([availableResult, componentsResult]) => {
        if (availableResult.status === "fulfilled") {
          setAvailableGroups(groupReleasesByTitle(availableResult.value));
        } else {
          const reason = availableResult.reason;
          setAvailableError(reason instanceof Error ? reason.message : "Failed to load available releases");
          setAvailableGroups([]);
        }
        if (componentsResult.status === "fulfilled") {
          setComponentGroups(groupReleasesByTitle(componentsResult.value));
        } else {
          const reason = componentsResult.reason;
          setComponentsError(reason instanceof Error ? reason.message : "Failed to load component releases");
          setComponentGroups([]);
        }
      })
      .finally(() => {
        setLoadingAvailableReleases(false);
        setLoadingComponentReleases(false);
        releasesFetchInFlight = false;
      });
  }, []);

  const runningInstances = instances.filter((i) => i.state === "running");
  const startingInstances = instances.filter((i) => i.state === "starting");
  const stoppingInstanceIds = new Set(
    instances.filter((i) => i.state === "stopping").map((i) => i.id)
  );

  // Running (or stopping) instances not in user's active list — show as "on robot" cards
  const runningOnly = instances.filter(
    (i) =>
      (i.state === "running" || i.state === "stopping") &&
      !activeProjects.some(
        (p) =>
          p.version === i.version &&
          (groupNameToSlug(p.name) === i.app || p.name === i.app)
      )
  );

  const isVersionRunningOnRobot = (groupName: string, tagName: string) =>
    runningInstances.some(
      (ri) =>
        ri.version === tagName &&
        (groupNameToSlug(groupName) === ri.app || groupName === ri.app)
    );

  const startInstanceOnRobot = (
    appSlug: string,
    version: string,
    displayName: string,
    projectUrl: string,
    image?: string
  ) => {
    if (!connection || (!connection.token && !isLocalRobotHost(connection))) {
      setStartError("Connect to a device to add apps to Active");
      return;
    }
    setStartError(null);
    createInstance(connection, appSlug, version, image)
      .then((created) => {
        setInstances((prev) => {
          if (prev.some((i) => i.id === created.id)) return prev;
          return [
            ...prev,
            {
              id: created.id,
              app: appSlug,
              version: created.version,
              state: "starting",
              displayName,
              projectUrl,
            },
          ];
        });
        const pollUntilRunning = () => {
          getInstance(connection!, created.id)
            .then((updated) => {
              if (updated.state === "running") {
                setInstances((prev) =>
                  prev.map((i) =>
                    i.id === created.id
                      ? { ...i, state: "running" as const, displayName: undefined, projectUrl: undefined }
                      : i
                  )
                );
                addActiveProject({ url: projectUrl, name: displayName, version });
                return;
              }
              if (updated.state === "crashed" || updated.state === "stopped") {
                removeInstance(created.id);
                setStartError(`${displayName} ${version} failed to start (${updated.state})`);
                return;
              }
              setTimeout(pollUntilRunning, 800);
            })
            .catch(() => {
              removeInstance(created.id);
              setStartError(`Failed to check status for ${displayName}`);
            });
        };
        pollUntilRunning();
      })
      .catch((err) => {
        setStartError(err instanceof Error ? err.message : "Failed to start app");
      });
  };

  const handleSelectVersion = (release: ReleaseWithSource, appSlug: string) => {
    const name = getReleaseGroupName(release);
    const version = release.tag_name;
    const url = release.html_url;
    startInstanceOnRobot(appSlug, version, name, url);
  };

  const handleRunLocalImage = (repository: string, tag: string) => {
    const displayName = repoNameFromOwnerRepo(repository);
    const appSlug = localAppSlugFromRepository(repository);
    const imageRef = `${repository}:${tag}`;
    startInstanceOnRobot(
      appSlug,
      tag,
      displayName,
      localProjectUrl(repository, tag),
      imageRef
    );
  };

  const findInstanceForProject = (project: { name: string; version: string }) =>
    instances.find(
      (i) =>
        (i.state === "running" || i.state === "stopping") &&
        i.version === project.version &&
        (groupNameToSlug(project.name) === i.app || project.name === i.app)
    );

  const handleStopInstance = (instance: Instance) => {
    if (
      !connection ||
      (!connection.token && !isLocalRobotHost(connection)) ||
      stoppingInstanceIds.has(instance.id)
    )
      return;
    setInstanceState(instance.id, "stopping");
    deleteInstance(connection, instance.id)
      .then(() => removeInstance(instance.id))
      .catch(() => setInstanceState(instance.id, "running"));
  };

  const handleRemoveActive = (project: { url: string; name: string; version: string }) => {
    const instance = findInstanceForProject(project);
    if (
      connection &&
      (connection.token || isLocalRobotHost(connection)) &&
      instance
    ) {
      setInstanceState(instance.id, "stopping");
      deleteInstance(connection, instance.id)
        .then(() => {
          removeInstance(instance.id);
          removeActiveProject(project.url);
        })
        .catch(() => setInstanceState(instance.id, "running"));
    } else {
      removeActiveProject(project.url);
    }
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
          {startError && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              <span className="flex-1">{startError}</span>
              <button
                type="button"
                onClick={() => setStartError(null)}
                className="shrink-0 rounded p-1 text-red-300 hover:bg-red-900/30 hover:text-red-200"
                aria-label="Dismiss"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          {activeProjects.length === 0 && runningOnly.length === 0 && startingInstances.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-6 text-center text-sm text-zinc-400">
              No active apps. Select an app from Available to add it here, or connect to a robot to see running apps.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {startingInstances.map((inst) => (
                <div
                  key={inst.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-4 transition-all"
                  style={{ boxShadow: "var(--blue-outline)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-zinc-100">{inst.displayName ?? inst.app}</div>
                    <div className="mt-0.5 font-mono text-sm text-zinc-400">{inst.version}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setLogInstanceId((prev) =>
                          prev === inst.id ? null : inst.id
                        )
                      }
                      className={`cursor-pointer rounded p-1.5 transition-colors ${
                        logInstanceId === inst.id
                          ? "bg-blue-900/50 text-blue-300"
                          : "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                      }`}
                      aria-label="Toggle logs"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded p-1.5 text-zinc-400"
                      aria-label="Starting…"
                    >
                      <svg
                        className="h-5 w-5 animate-spin"
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
                    </div>
                  </div>
                </div>
              ))}
              {activeProjects.map((project) => {
                const matchingInstance = findInstanceForProject(project);
                const isStopping = matchingInstance?.state === "stopping";
                return (
                  <div
                    key={project.url}
                    className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-4 transition-all"
                    style={{ boxShadow: "var(--blue-outline)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-zinc-100">{project.name}</div>
                      <div className="mt-0.5 font-mono text-sm text-zinc-400">{project.version}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {matchingInstance && !isStopping && (
                        <button
                          type="button"
                          onClick={() =>
                            setLogInstanceId((prev) =>
                              prev === matchingInstance.id
                                ? null
                                : matchingInstance.id
                            )
                          }
                          className={`cursor-pointer rounded p-1.5 transition-colors ${
                            logInstanceId === matchingInstance?.id
                              ? "bg-blue-900/50 text-blue-300"
                              : "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                          }`}
                          aria-label="Toggle logs"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveActive(project)}
                        disabled={isStopping}
                        className="cursor-pointer rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-70"
                        aria-label="Stop and remove from active"
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
                  </div>
                );
              })}
              {runningOnly.map((inst) => {
                const isStopping = inst.state === "stopping";
                return (
                  <div
                    key={inst.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-4 transition-all"
                    style={{ boxShadow: "var(--blue-outline)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-zinc-100">{inst.app}</div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="font-mono text-sm text-zinc-400">{inst.version}</span>
                        <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-400">on robot</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!isStopping && (
                        <button
                          type="button"
                          onClick={() =>
                            setLogInstanceId((prev) =>
                              prev === inst.id ? null : inst.id
                            )
                          }
                          className={`cursor-pointer rounded p-1.5 transition-colors ${
                            logInstanceId === inst.id
                              ? "bg-blue-900/50 text-blue-300"
                              : "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
                          }`}
                          aria-label="Toggle logs"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleStopInstance(inst)}
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
                  </div>
                );
              })}
            </div>
          )}

          {/* Log panel for selected instance */}
          {logInstanceId &&
            connection &&
            instances.some((i) => i.id === logInstanceId) && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-zinc-400">Streaming logs from</span>
                    <span className="font-mono font-medium text-zinc-200">
                      {instances.find((i) => i.id === logInstanceId)?.app ??
                        logInstanceId.slice(0, 8)}
                    </span>
                    <span className="font-mono text-xs text-zinc-500">
                      {instances.find((i) => i.id === logInstanceId)?.version}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLogInstanceId(null)}
                    className="cursor-pointer rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                    aria-label="Close log panel"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="h-[400px]">
                  <LogViewer
                    key={logInstanceId}
                    connection={connection}
                    instanceId={logInstanceId}
                  />
                </div>
              </div>
            )}
        </section>

        {connection?.devMode && (
          <section className="mb-8">
            <h2 className="mb-4 text-lg font-medium text-zinc-200">Available Locally</h2>
            <p className="mb-4 text-sm text-zinc-500">
              Container images on this machine from your local Cortex server.
            </p>
            {loadingLocalImages && (
              <div className="flex items-center justify-center py-8 text-zinc-400">Loading local images…</div>
            )}
            {localImagesError && (
              <div className="flex items-start gap-3 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
                <span className="flex-1">{localImagesError}</span>
                <button
                  type="button"
                  onClick={() => setLocalImagesError(null)}
                  className="shrink-0 rounded p-1 text-red-300 hover:bg-red-900/30 hover:text-red-200"
                  aria-label="Dismiss"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            {!loadingLocalImages && !localImagesError && localImages.length === 0 && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-6 text-center text-sm text-zinc-400">
                No local container images reported.
              </div>
            )}
            {!loadingLocalImages && !localImagesError && localImages.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {buildLocalRunRows(localImages).map((row) => {
                  const { repository, tag, img } = row;
                  const shortName = repoNameFromOwnerRepo(repository);
                  const hasTag = tag.length > 0;
                  const canRun =
                    hasTag &&
                    connection &&
                    (connection.token || isLocalRobotHost(connection));
                  const highlighted =
                    (hasTag && isActive(localProjectUrl(repository, tag))) ||
                    (hasTag && isVersionRunningOnRobot(shortName, tag));
                  return (
                    <div
                      key={`${repository}:${tag}:${img.id}`}
                      className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-4 transition-all"
                      style={{
                        boxShadow: highlighted ? "var(--blue-outline)" : "none",
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-zinc-100">{shortName}</div>
                        <div className="mt-0.5 font-mono text-sm text-zinc-400">
                          {hasTag ? tag : "(untagged)"}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="break-all rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
                            {repository}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-zinc-500">
                          <span className="text-zinc-600">Size</span>{" "}
                          <span className="text-zinc-400">{img.size}</span>
                          <span className="mx-2 text-zinc-700">·</span>
                          <span className="text-zinc-600">Created</span>{" "}
                          <span className="text-zinc-400">{img.created_at}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRunLocalImage(repository, tag)}
                        disabled={!canRun}
                        title={!hasTag ? "Image has no tag" : !connection ? "Connect to a robot" : undefined}
                        className="shrink-0 cursor-pointer rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Run
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section>
          <h2 className="mb-4 text-lg font-medium text-zinc-200">Available Online</h2>

          {loadingAvailableReleases && (
            <div className="flex items-center justify-center py-12 text-zinc-400">
              Loading releases…
            </div>
          )}

          {availableError && (
            <div className="flex items-start gap-3 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              <span className="flex-1">{availableError}</span>
              <button
                type="button"
                onClick={() => setAvailableError(null)}
                className="shrink-0 rounded p-1 text-red-300 hover:bg-red-900/30 hover:text-red-200"
                aria-label="Dismiss"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {!loadingAvailableReleases && !availableError && availableGroups.length === 0 && (
            <div className="py-12 text-center text-zinc-400">No releases found.</div>
          )}

          {!loadingAvailableReleases && !availableError && availableGroups.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {availableGroups.map((group) => {
                const cardRepos = uniqueReposForGroup(group);
                const commonChannels = getCommonReleaseChannels(group.versions);
                const menuKey = `available:${group.groupName}`;
                return (
                  <div
                    key={menuKey}
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
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {commonChannels.map((channel) => (
                          <ReleaseTag
                            key={channel}
                            label={RELEASE_CHANNEL_LABELS[channel]}
                            className={RELEASE_CHANNEL_BADGE_CLASSES[channel]}
                          />
                        ))}
                        {cardRepos.map((repo) => (
                          <ReleaseTag
                            key={repo}
                            label={repo}
                            className="bg-zinc-700 text-zinc-300"
                          />
                        ))}
                      </div>
                    </div>
                    <VersionMenu
                      group={group}
                      appSlug={groupNameToSlug(group.groupName)}
                      onSelectVersion={handleSelectVersion}
                      activeProjectUrls={activeProjectUrls}
                      isVersionRunningOnRobot={(tagName) =>
                        isVersionRunningOnRobot(group.groupName, tagName)
                      }
                      open={openMenuGroup === menuKey}
                      onToggle={() =>
                        setOpenMenuGroup((prev) => (prev === menuKey ? null : menuKey))
                      }
                      onClose={() => setOpenMenuGroup(null)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="mb-4 text-lg font-medium text-zinc-200">Components</h2>

          {loadingComponentReleases && (
            <div className="flex items-center justify-center py-12 text-zinc-400">
              Loading releases…
            </div>
          )}

          {componentsError && (
            <div className="flex items-start gap-3 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              <span className="flex-1">{componentsError}</span>
              <button
                type="button"
                onClick={() => setComponentsError(null)}
                className="shrink-0 rounded p-1 text-red-300 hover:bg-red-900/30 hover:text-red-200"
                aria-label="Dismiss"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {!loadingComponentReleases && !componentsError && componentGroups.length === 0 && (
            <div className="py-12 text-center text-zinc-400">No releases found.</div>
          )}

          {!loadingComponentReleases && !componentsError && componentGroups.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {componentGroups.map((group) => {
                const cardRepos = uniqueReposForGroup(group);
                const commonChannels = getCommonReleaseChannels(group.versions);
                const menuKey = `components:${group.groupName}`;
                return (
                  <div
                    key={menuKey}
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
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {commonChannels.map((channel) => (
                          <ReleaseTag
                            key={channel}
                            label={RELEASE_CHANNEL_LABELS[channel]}
                            className={RELEASE_CHANNEL_BADGE_CLASSES[channel]}
                          />
                        ))}
                        {cardRepos.map((repo) => (
                          <ReleaseTag
                            key={repo}
                            label={repo}
                            className="bg-zinc-700 text-zinc-300"
                          />
                        ))}
                      </div>
                    </div>
                    <VersionMenu
                      group={group}
                      appSlug={groupNameToSlug(group.groupName)}
                      onSelectVersion={handleSelectVersion}
                      activeProjectUrls={activeProjectUrls}
                      isVersionRunningOnRobot={(tagName) =>
                        isVersionRunningOnRobot(group.groupName, tagName)
                      }
                      open={openMenuGroup === menuKey}
                      onToggle={() =>
                        setOpenMenuGroup((prev) => (prev === menuKey ? null : menuKey))
                      }
                      onClose={() => setOpenMenuGroup(null)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
