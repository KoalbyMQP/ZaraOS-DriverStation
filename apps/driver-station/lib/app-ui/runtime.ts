import { createInstance } from "@module-federation/runtime";
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as jsxRuntime from "react/jsx-runtime";
import * as jsxDevRuntime from "react/jsx-dev-runtime";
import type { AppUiDescriptor } from "./schema";
import type { AppPageProps } from "./types";

type RemoteModule = { default: React.ComponentType<AppPageProps> };
const modules = new Map<string, Promise<RemoteModule>>();
const registrations = new Map<string, string>();
const failedRemotes = new Set<string>();
let runtime: ReturnType<typeof createInstance> | undefined;

function getRuntime() {
  if (typeof window === "undefined") throw new Error("App UI can only load in the browser.");
  runtime ??= createInstance({
    name: "zaraos_driver_station",
    remotes: [],
    shareStrategy: "loaded-first",
    shared: Object.fromEntries(
      Object.entries({
        react: React,
        "react-dom": ReactDOM,
        "react/jsx-runtime": jsxRuntime,
        "react/jsx-dev-runtime": jsxDevRuntime,
      }).map(([name, lib]) => [
        name,
        {
          version: React.version,
          lib: () => lib,
          shareConfig: { singleton: true, requiredVersion: React.version },
        },
      ])
    ),
  });
  return runtime;
}

/** Call only from a mounted browser component. Failures are evicted so Retry can reload. */
export function loadAppPage(descriptor: AppUiDescriptor, pageId: string): Promise<RemoteModule> {
  if (!Object.hasOwn(descriptor.pages, pageId)) return Promise.reject(new Error("This App page is unavailable."));
  const page = descriptor.pages[pageId];
  const { name, entry, type } = descriptor.federation;
  const key = JSON.stringify([name, entry, type, page.module]);
  const existing = modules.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const mf = getRuntime();
    const registered = registrations.get(name);
    // Containers also have global identities. Never silently replace another release or robot's code.
    if (registered && registered !== entry)
      throw new Error("This UI build name is already in use at another address. Reload to switch builds.");
    if (!registered || failedRemotes.has(name)) {
      mf.registerRemotes([{ name, entry, type }], { force: failedRemotes.has(name) });
      failedRemotes.delete(name);
      registrations.set(name, entry);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const remote = await Promise.race([
        mf.loadRemote<RemoteModule>(`${name}/${page.module.slice(2)}`),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("The App page took too long to load.")), 15000);
        }),
      ]);
      if (!remote?.default) throw new Error("The App page must have a default React export.");
      return remote;
    } catch (error) {
      failedRemotes.add(name);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  })();
  modules.set(key, promise);
  void promise.catch(() => {
    modules.delete(key);
  });
  return promise;
}
