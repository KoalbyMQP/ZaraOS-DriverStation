"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const ACTIVE_PROJECTS_KEY = "driver-station-active-projects";

export type SelectedProject = {
  url: string;
  name: string;
  version: string;
};

type ProjectContextValue = {
  activeProjects: SelectedProject[];
  addActiveProject: (project: SelectedProject) => void;
  removeActiveProject: (url: string) => void;
  isActive: (url: string) => boolean;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

function loadFromStorage(): SelectedProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACTIVE_PROJECTS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (item): item is SelectedProject =>
        item &&
        typeof item === "object" &&
        "url" in item &&
        "name" in item &&
        "version" in item &&
        typeof (item as SelectedProject).url === "string" &&
        typeof (item as SelectedProject).name === "string" &&
        typeof (item as SelectedProject).version === "string"
    );
  } catch {
    return [];
  }
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [activeProjects, setActiveProjectsState] = useState<SelectedProject[]>([]);

  // Hydrate from localStorage after SSR — must be in useEffect to avoid mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setActiveProjectsState(loadFromStorage()); }, []);

  const persist = useCallback((list: SelectedProject[]) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(ACTIVE_PROJECTS_KEY, JSON.stringify(list));
    }
  }, []);

  const addActiveProject = useCallback(
    (project: SelectedProject) => {
      setActiveProjectsState((prev) => {
        if (prev.some((p) => p.url === project.url)) return prev;
        const next = [...prev, project];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removeActiveProject = useCallback(
    (url: string) => {
      setActiveProjectsState((prev) => {
        const next = prev.filter((p) => p.url !== url);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const isActive = useCallback((url: string) => {
    return activeProjects.some((p) => p.url === url);
  }, [activeProjects]);

  return (
    <ProjectContext.Provider
      value={{ activeProjects, addActiveProject, removeActiveProject, isActive }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
