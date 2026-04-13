/**
 * GitHub release helpers used by the Apps page.
 * All legacy backend auth functions have been removed — auth is now
 * handled entirely by Azure MSAL (see contexts/AuthContext.tsx).
 */

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
const CORE_REPO = "KoalbyMQP/Core";
const DRIVERS_REPO = "KoalbyMQP/Drivers";
const CONTROL_REPO = "KoalbyMQP/Control";
const SENSING_REPO = "KoalbyMQP/Sensing";

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
  const releases = await fetchGitHubReleases(CORE_REPO);
  return { releases };
}

export async function getAppsReleases(): Promise<{ releases: Release[] }> {
  const releases = await fetchGitHubReleases(APPS_REPO);
  return { releases };
}

export type ReleaseSource = "apps" | "core" | "drivers" | "control" | "sensing";

export type ReleaseWithSource = Release & {
  source: ReleaseSource;
  repo: string;
};

export type ReleaseChannel =
  | "alpha"
  | "beta"
  | "rc"
  | "preview"
  | "nightly"
  | "canary"
  | "prerelease";

function mapWithSource(releases: Release[], source: ReleaseSource, repo: string): ReleaseWithSource[] {
  return releases.map((rel) => ({ ...rel, source, repo }));
}

export async function getCombinedReleases(): Promise<ReleaseWithSource[]> {
  const [core, apps] = await Promise.all([
    getCoreReleases().then((r) => mapWithSource(r.releases, "core", CORE_REPO)),
    getAppsReleases().then((r) => mapWithSource(r.releases, "apps", APPS_REPO)),
  ]);
  return [...core, ...apps];
}

export async function getComponentsReleases(): Promise<ReleaseWithSource[]> {
  const [drivers, control, sensing] = await Promise.all([
    fetchGitHubReleases(DRIVERS_REPO).then((releases) => mapWithSource(releases, "drivers", DRIVERS_REPO)),
    fetchGitHubReleases(CONTROL_REPO).then((releases) => mapWithSource(releases, "control", CONTROL_REPO)),
    fetchGitHubReleases(SENSING_REPO).then((releases) => mapWithSource(releases, "sensing", SENSING_REPO)),
  ]);
  return [...drivers, ...control, ...sensing];
}

/**
 * Derive a group name from a release so that "chess-v1.0" and "chess-v2.0" group under "chess".
 * Strips a trailing version (tag_name) from the release name when present.
 */
export function getReleaseGroupName(release: Release): string {
  const name = (release.name || release.tag_name).trim();
  const tag = release.tag_name.trim();
  const candidates = Array.from(
    new Set(
      [tag, tag.replace(/^v/i, ""), tag.startsWith("v") ? tag : `v${tag}`].filter(Boolean)
    )
  );

  for (const candidate of candidates) {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const suffixPattern = new RegExp(`(?:[\\s_-]+)?${escaped}$`, "i");
    if (suffixPattern.test(name)) {
      const stripped = name.replace(suffixPattern, "").replace(/[\s_-]+$/, "").trim();
      if (stripped) return stripped;
    }
  }

  const genericVersionSuffix = /(?:[\s_-]+)?v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/i;
  if (genericVersionSuffix.test(name)) {
    const stripped = name.replace(genericVersionSuffix, "").replace(/[\s_-]+$/, "").trim();
    if (stripped) return stripped;
  }

  return name;
}

export function getReleaseChannel(release: Release): ReleaseChannel | null {
  const haystack = `${release.tag_name} ${release.name ?? ""}`.toLowerCase();
  const channelMatchers: Array<[ReleaseChannel, RegExp]> = [
    ["alpha", /(?:^|[.\-_/+\s])alpha(?:[.\-_/+\s]?\d+)?(?:$|[.\-_/+\s])/],
    ["beta", /(?:^|[.\-_/+\s])beta(?:[.\-_/+\s]?\d+)?(?:$|[.\-_/+\s])/],
    ["rc", /(?:^|[.\-_/+\s])rc(?:[.\-_/+\s]?\d+)?(?:$|[.\-_/+\s])/],
    ["preview", /(?:^|[.\-_/+\s])preview(?:[.\-_/+\s]?\d+)?(?:$|[.\-_/+\s])/],
    ["nightly", /(?:^|[.\-_/+\s])nightly(?:$|[.\-_/+\s])/],
    ["canary", /(?:^|[.\-_/+\s])canary(?:$|[.\-_/+\s])/],
  ];

  for (const [channel, pattern] of channelMatchers) {
    if (pattern.test(haystack)) return channel;
  }

  return release.prerelease ? "prerelease" : null;
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
