"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useConnection, type Connection } from "@/contexts/ConnectionContext";
import {
  createInstance,
  deleteInstance,
  getInstance,
  getInstances,
  getImages,
  type LocalContainerImage,
  type RobotAppInstance,
} from "@/lib/robot-api";

export type SelectedProject = { url: string; name: string; version: string };
export type AppLaunch = SelectedProject & { app: string; image?: string };

type ProjectContextValue = {
  images: LocalContainerImage[];
  imagesLoading: boolean;
  imagesError: string | null;
  instances: RobotAppInstance[];
  loading: boolean;
  error: string | null;
  actionError: string | null;
  notice: string | null;
  pendingRuns: string[];
  stoppingIds: string[];
  refresh: () => Promise<void>;
  startApp: (app: AppLaunch) => Promise<void>;
  stopApp: (instance: RobotAppInstance) => Promise<void>;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);
export const appSlug = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "");

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  // A different robot gets fresh requests and state; work from the old connection is cancelled.
  return (
    <ProjectSession key={JSON.stringify(connection)} connection={connection}>
      {children}
    </ProjectSession>
  );
}

function ProjectSession({ connection, children }: { connection: Connection | null; children: ReactNode }) {
  const [images, setImages] = useState<LocalContainerImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(!!connection);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [instances, setInstances] = useState<RobotAppInstance[]>([]);
  const [loading, setLoading] = useState(!!connection);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingRuns, setPendingRuns] = useState<string[]>([]);
  const [stoppingIds, setStoppingIds] = useState<string[]>([]);
  const runningRequests = useRef(new Set<string>());
  const lifecycle = useRef(new AbortController());

  const refresh = useCallback(async () => {
    if (!connection) return;
    const signal = lifecycle.current.signal;
    await Promise.all([
      getInstances(connection, signal)
        .then((data) => {
          if (signal.aborted) return;
          setInstances(data.instances ?? []);
          setError(null);
        })
        .catch((err: unknown) => {
          if (!signal.aborted) setError(err instanceof Error ? err.message : "Could not load app status.");
        })
        .finally(() => {
          if (!signal.aborted) setLoading(false);
        }),
      getImages(connection, signal)
        .then((data) => {
          if (signal.aborted) return;
          setImages(data.images ?? []);
          setImagesError(null);
        })
        .catch((err: unknown) => {
          if (!signal.aborted) setImagesError(err instanceof Error ? err.message : "Could not load installed apps.");
        })
        .finally(() => {
          if (!signal.aborted) setImagesLoading(false);
        }),
    ]);
  }, [connection]);

  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [refresh]);

  async function startApp(app: AppLaunch) {
    if (!connection || runningRequests.current.has(app.url)) return;
    const signal = lifecycle.current.signal;
    runningRequests.current.add(app.url);
    setPendingRuns((prev) => [...prev, app.url]);
    setActionError(null);
    setNotice(null);
    try {
      let instance = await createInstance(connection, app.app, app.version, app.image, signal);
      for (let attempt = 0; instance.state === "starting" && attempt < 38 && !signal.aborted; attempt++) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 800));
        if (signal.aborted) return;
        instance = await getInstance(connection, instance.id, signal);
      }
      if (signal.aborted) return;
      if (instance.state !== "running")
        throw new Error(
          instance.error ||
            `${app.name} ${app.version} ${instance.state === "starting" ? "is still starting. Check the Apps sidebar for its status." : `failed to start (${instance.state}).`}`
        );
      setInstances((prev) => [...prev.filter((i) => i.id !== instance.id), instance]);
      setNotice(`${app.name} ${app.version} started. View its status in the Apps sidebar.`);
      await refresh();
    } catch (err) {
      if (!signal.aborted) {
        setActionError(err instanceof Error ? err.message : "Failed to start app.");
        void refresh();
      }
    } finally {
      runningRequests.current.delete(app.url);
      if (!signal.aborted) setPendingRuns((prev) => prev.filter((url) => url !== app.url));
    }
  }

  async function stopApp(instance: RobotAppInstance) {
    if (!connection || stoppingIds.includes(instance.id)) return;
    const signal = lifecycle.current.signal;
    setStoppingIds((prev) => [...prev, instance.id]);
    setActionError(null);
    try {
      await deleteInstance(connection, instance.id);
      if (signal.aborted) return;
      setInstances((prev) => prev.filter((i) => i.id !== instance.id));
      await refresh();
    } catch (err) {
      if (!signal.aborted) setActionError(err instanceof Error ? err.message : "Failed to stop app.");
    } finally {
      if (!signal.aborted) setStoppingIds((prev) => prev.filter((id) => id !== instance.id));
    }
  }

  return (
    <ProjectContext.Provider
      value={{
        images,
        imagesLoading,
        imagesError,
        instances,
        loading,
        error,
        actionError,
        notice,
        pendingRuns,
        stoppingIds,
        refresh,
        startApp,
        stopApp,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error("useProject must be used within ProjectProvider");
  return context;
}
