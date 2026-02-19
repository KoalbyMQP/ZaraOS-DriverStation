"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const SELECTED_PROJECT_KEY = "driver-station-selected-project";

export type SelectedProject = {
  url: string;
  name: string;
  version: string;
};

type ProjectContextValue = {
  selectedProject: SelectedProject | null;
  setSelectedProject: (project: SelectedProject | null) => void;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

function loadFromStorage(): SelectedProject | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SELECTED_PROJECT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (
      data &&
      typeof data === "object" &&
      "url" in data &&
      "name" in data &&
      "version" in data &&
      typeof (data as SelectedProject).url === "string" &&
      typeof (data as SelectedProject).name === "string" &&
      typeof (data as SelectedProject).version === "string"
    ) {
      return data as SelectedProject;
    }
  } catch {
    // ignore
  }
  return null;
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [selectedProject, setSelectedProjectState] = useState<SelectedProject | null>(null);

  useEffect(() => {
    setSelectedProjectState(loadFromStorage());
  }, []);

  const setSelectedProject = useCallback((project: SelectedProject | null) => {
    setSelectedProjectState(project);
    if (typeof window === "undefined") return;
    if (project) {
      localStorage.setItem(SELECTED_PROJECT_KEY, JSON.stringify(project));
    } else {
      localStorage.removeItem(SELECTED_PROJECT_KEY);
    }
  }, []);

  return (
    <ProjectContext.Provider value={{ selectedProject, setSelectedProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
