"use client";

import { useSyncExternalStore } from "react";
import type { InstanceOptions } from "@/lib/robot-api";

/**
 * Container options for starting an app, saved per app in this browser.
 * Every launch of that app from this browser sends them to Cortex.
 */
const STORAGE_KEY = "driver-station-launch-options";
const NONE: InstanceOptions = {};
const NOTHING_SAVED: Record<string, InstanceOptions> = {};
const listeners = new Set<() => void>();
let cache: { raw: string | null; saved: Record<string, InstanceOptions> } = { raw: null, saved: NOTHING_SAVED };

function readSaved(): Record<string, InstanceOptions> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private windows); apps then start with their defaults.
  }
  if (raw !== cache.raw) {
    let saved = NOTHING_SAVED;
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") saved = parsed as Record<string, InstanceOptions>;
    } catch {
      // Unreadable data counts as nothing saved.
    }
    cache = { raw, saved };
  }
  return cache.saved;
}

export function hasLaunchOptions(options: InstanceOptions): boolean {
  return (
    !!options.privileged ||
    !!options.devices?.length ||
    !!options.volumes?.length ||
    Object.keys(options.env ?? {}).length > 0
  );
}

export function launchOptionsFor(app: string): InstanceOptions {
  return readSaved()[app] ?? NONE;
}

export function saveLaunchOptions(app: string, options: InstanceOptions) {
  const next = Object.fromEntries(Object.entries(readSaved()).filter(([name]) => name !== app));
  if (hasLaunchOptions(options)) next[app] = options;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** The options saved for an app, kept current when they are edited here or in another tab. */
export function useLaunchOptions(app: string): InstanceOptions {
  return useSyncExternalStore(
    subscribe,
    () => launchOptionsFor(app),
    () => NONE
  );
}

const lines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** The text the options dialog edits: one entry per line. */
export type LaunchOptionsText = { privileged: boolean; env: string; volumes: string; devices: string };

export function launchOptionsToText(options: InstanceOptions): LaunchOptionsText {
  return {
    privileged: !!options.privileged,
    env: Object.entries(options.env ?? {})
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
    volumes: (options.volumes ?? []).join("\n"),
    devices: (options.devices ?? []).join("\n"),
  };
}

/** Parse the dialog's text. Returns the options, or the first problem in each field. */
export function parseLaunchOptions(
  text: LaunchOptionsText
): { options: InstanceOptions } | { errors: { env?: string; volumes?: string } } {
  const errors: { env?: string; volumes?: string } = {};
  const env: Record<string, string> = {};
  for (const line of lines(text.env)) {
    const separator = line.indexOf("=");
    const key = line.slice(0, separator).trim();
    if (separator < 1 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      errors.env = `“${line}” is not a variable. Write each one as NAME=value.`;
      break;
    }
    env[key] = line.slice(separator + 1);
  }
  const volumes = lines(text.volumes);
  const badVolume = volumes.find((volume) => !/^[^:]+:[^:]+(:[^:]+)?$/.test(volume));
  if (badVolume) errors.volumes = `“${badVolume}” is not a mount. Write each one as /robot/path:/app/path.`;
  if (errors.env || errors.volumes) return { errors };
  return { options: { privileged: text.privileged, env, volumes, devices: lines(text.devices) } };
}
