"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useConnection } from "@/contexts/ConnectionContext";
import { useProject } from "@/contexts/ProjectContext";
import { robotBaseUrl } from "@/lib/robot-api";
import { assetUrl, fetchDescriptor, type AppUiDescriptor } from "@/lib/app-ui/schema";

type DescriptorState = { descriptor?: AppUiDescriptor; error?: string };
type AppUiContextValue = {
  sources: Record<string, string>;
  descriptors: Record<string, DescriptorState>;
  retry: () => void;
};

const AppUiContext = createContext<AppUiContextValue | null>(null);

export function AppUiProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  return <AppUiSession key={JSON.stringify(connection)}>{children}</AppUiSession>;
}

function AppUiSession({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const { instances } = useProject();
  const [descriptors, setDescriptors] = useState<Record<string, DescriptorState>>({});
  const [revision, setRevision] = useState(0);
  const sources: Record<string, string> = {};
  for (const instance of instances) {
    const url = instance.ui?.descriptor_url;
    if (url && connection) {
      try {
        sources[instance.id] = assetUrl(url, robotBaseUrl(connection) + "/");
      } catch {
        sources[instance.id] = url;
      }
    }
  }
  const sourceKey = JSON.stringify([...new Set(Object.values(sources))].sort());

  useEffect(() => {
    const controller = new AbortController();
    const urls = JSON.parse(sourceKey) as string[];
    for (const url of urls) {
      void (async () => {
        let state: DescriptorState;
        try {
          state = {
            descriptor: await fetchDescriptor(
              assetUrl(url, window.location.href),
              AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
            ),
          };
        } catch (error) {
          state = { error: error instanceof Error ? error.message : "App UI could not be loaded." };
        }
        if (!controller.signal.aborted) setDescriptors((current) => ({ ...current, [url]: state }));
      })();
    }
    return () => controller.abort();
  }, [sourceKey, revision]);

  return (
    <AppUiContext.Provider value={{ sources, descriptors, retry: () => setRevision((value) => value + 1) }}>
      {children}
    </AppUiContext.Provider>
  );
}

export function useAppUi() {
  const context = useContext(AppUiContext);
  if (!context) throw new Error("useAppUi must be used within AppUiProvider");
  return context;
}

export function useInstanceUi(instanceId: string) {
  const { instances, loading, error } = useProject();
  const { sources, descriptors } = useAppUi();
  const instance = instances.find((candidate) => candidate.id === instanceId);
  const source = sources[instanceId];
  const state = source ? descriptors[source] : undefined;
  if (loading) return { instance, loading: true };
  if (error) return { instance, error: "App status is unavailable." };
  if (!instance) return { error: "This App instance is unavailable." };
  if (!source) return { instance, error: "This App has no UI." };
  if (!state) return { instance, loading: true };
  if (state.error) return { instance, error: state.error };
  const descriptor = state.descriptor;
  if (descriptor?.appId !== instance.app || descriptor.appVersion !== instance.version) {
    return { instance, error: "The UI description does not match this App version." };
  }
  return { instance, descriptor };
}
