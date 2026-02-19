import { API_URL, AUTH_TOKEN_KEY } from "./auth-config";

/**
 * Get auth headers for API requests. Only call from client (uses localStorage).
 */
export function getAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") {
    return { "Content-Type": "application/json" };
  }
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  email_verified: boolean;
};

export async function authMe(): Promise<{ user: User }> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Invalid token");
  return res.json();
}

export async function checkEmail(email: string): Promise<{ action: string }> {
  const res = await fetch(`${API_URL}/auth/check_email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || "An error occurred");
  }
  return res.json();
}

export async function signup(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<void> {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
    }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((out as { error?: string }).error || "Signup failed");
}

export async function login(email: string, password: string): Promise<{ token: string }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if ((data as { emailVerified?: boolean }).emailVerified === false) {
      const e = new Error("EMAIL_NOT_VERIFIED") as Error & { emailVerified?: boolean };
      e.emailVerified = false;
      throw e;
    }
    throw new Error((data as { error?: string }).error || "Login failed");
  }
  return data as { token: string };
}

export async function forgotPassword(email: string): Promise<{ message?: string }> {
  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  return data as { message?: string };
}

export async function sendTerminalCommand(command: string): Promise<{ output?: string; error?: string }> {
  const res = await fetch(`${API_URL}/api/terminal/command`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ command }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: string }).error || res.statusText;
    return { error: err };
  }
  return data as { output?: string; error?: string };
}

export type Release = {
  id: number;
  tag_name: string;
  name: string;
  body: string | null;
  html_url: string;
  created_at: string;
  published_at: string;
  draft: boolean;
  prerelease: boolean;
};

const GITHUB_API = "https://api.github.com";
const GITHUB_HEADERS: HeadersInit = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

const APPS_REPO =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_GITHUB_APPS_REPO) ||
  "KoalbyMQP/Apps";

function mapGitHubRelease(raw: {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  created_at: string;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
}): Release {
  return {
    id: raw.id,
    tag_name: raw.tag_name,
    name: raw.name ?? raw.tag_name,
    body: raw.body,
    html_url: raw.html_url,
    created_at: raw.created_at,
    published_at: raw.published_at ?? raw.created_at,
    draft: raw.draft,
    prerelease: raw.prerelease,
  };
}

async function fetchGitHubReleases(ownerRepo: string): Promise<Release[]> {
  const url = `${GITHUB_API}/repos/${ownerRepo}/releases?per_page=50`;
  const res = await fetch(url, { headers: GITHUB_HEADERS });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { message?: string }).message || res.statusText;
    throw new Error(msg);
  }
  return (Array.isArray(data) ? data : []).map(mapGitHubRelease);
}

export async function getCoreReleases(): Promise<{ releases: Release[] }> {
  const releases = await fetchGitHubReleases("KoalbyMQP/Core");
  return { releases };
}

export async function getAppsReleases(): Promise<{ releases: Release[] }> {
  const releases = await fetchGitHubReleases(APPS_REPO);
  return { releases };
}

export type ReleaseWithSource = Release & { source: "core" | "apps" };

export async function getCombinedReleases(): Promise<ReleaseWithSource[]> {
  const [core, apps] = await Promise.all([
    getCoreReleases().then((r) => r.releases.map((rel) => ({ ...rel, source: "core" as const }))),
    getAppsReleases().then((r) => r.releases.map((rel) => ({ ...rel, source: "apps" as const }))),
  ]);
  return [...core, ...apps];
}

/**
 * Derive a group name from a release so that "chess-v1.0" and "chess-v2.0" group under "chess".
 * Strips a trailing version (tag_name) from the release name when present.
 */
export function getReleaseGroupName(release: Release): string {
  const name = release.name || release.tag_name;
  const tag = release.tag_name;
  if (tag && name.endsWith(tag)) {
    return name.slice(0, -tag.length).replace(/-+$/, "").trim() || name;
  }
  return name;
}

export type ReleaseGroup = {
  groupName: string;
  versions: ReleaseWithSource[];
};

export function groupReleasesByTitle(releases: ReleaseWithSource[]): ReleaseGroup[] {
  const byGroup = new Map<string, ReleaseWithSource[]>();
  for (const r of releases) {
    const key = getReleaseGroupName(r);
    const list = byGroup.get(key) ?? [];
    list.push(r);
    byGroup.set(key, list);
  }
  return Array.from(byGroup.entries(), ([groupName, versions]) => ({
    groupName,
    versions,
  })).sort((a, b) => a.groupName.localeCompare(b.groupName));
}
