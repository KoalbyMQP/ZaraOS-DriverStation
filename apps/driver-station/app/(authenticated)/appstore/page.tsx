"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Badge } from "@repo/ui/components/badge/badge";
import { Banner } from "@repo/ui/components/banner/banner";
import { Button } from "@repo/ui/components/button/button";
import { DropdownMenu } from "@repo/ui/components/dropdown/dropdown";
import { Empty } from "@repo/ui/components/empty/empty";
import { Field } from "@repo/ui/components/field/field";
import { InputGroup } from "@repo/ui/components/input-group/input-group";
import { LayerCard } from "@repo/ui/components/layer-card/layer-card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Spinner } from "@repo/ui/components/spinner";
import {
  ArrowClockwiseIcon,
  CaretRightIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PackageIcon,
  SlidersHorizontalIcon,
  WarningCircleIcon,
} from "@repo/ui/icons";
import { LaunchOptionsDialog } from "@/components/LaunchOptionsDialog";
import { useConnection } from "@/contexts/ConnectionContext";
import { appSlug, isLive, useProject, type AppLaunch } from "@/contexts/ProjectContext";
import { hasLaunchOptions, useLaunchOptions } from "@/lib/launch-options";
import {
  getCombinedReleases,
  getComponentsReleases,
  getReleaseChannel,
  groupReleasesByTitle,
  type ReleaseSource,
  type ReleaseWithSource,
} from "@/lib/api";

const sources: Record<ReleaseSource, string> = {
  core: "Core",
  apps: "Apps",
  drivers: "Drivers",
  control: "Control",
  sensing: "Sensing",
};
const errorIcon = <WarningCircleIcon weight="fill" />;
const imageName = (repository: string) => repository.split("/").at(-1) || repository;
const runnableTags = (tags: string[]) =>
  [...new Set(tags.filter((tag) => tag && tag !== "<none>"))].sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true })
  );

type CatalogApp = {
  id: string;
  name: string;
  source: string;
  versions: AppLaunch[];
  installed?: boolean;
  installationKnown?: boolean;
  channel?: string | null;
  /** Versions are releases, newest first, so a running older version can be offered an update. */
  released?: boolean;
};

/** Split an image reference into the app it runs and its version, or null if it is not one. */
function parseImage(image: string): { name: string; app: string; version: string } | null {
  const [repository = "", digest] = image.split("@");
  // Read the tag from the last path segment so registry ports stay intact.
  const [name = "", tag] = (repository.split("/").at(-1) ?? "").split(":");
  const app = appSlug(name);
  if (!app || /\s|:\/\//.test(image) || tag === "" || digest === "") return null;
  return { name, app, version: digest ?? tag ?? "latest" };
}

function DirectImageForm() {
  const labelId = useId();
  const { connection } = useConnection();
  const { startApp, pendingRuns } = useProject();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const image = value.trim();
  const url = `image:${image}`;
  const pending = pendingRuns.includes(url);
  const parsed = parseImage(image);
  const customized = hasLaunchOptions(useLaunchOptions(parsed?.app ?? ""));

  function runImage() {
    if (!connection || !image || pending) return;
    if (!parsed) {
      setError("Enter an image reference such as ghcr.io/koalbymqp/python-example:test-1, without https://.");
      return;
    }
    setError(null);
    void startApp({ url, ...parsed, image });
  }

  return (
    <>
      <form
        aria-label="Run container image"
        onSubmit={(event) => {
          event.preventDefault();
          runImage();
        }}
      >
        <Field
          label={<span id={labelId}>Container image</span>}
          description={
            !connection
              ? "Connect to a robot to run an image."
              : customized
                ? `Runs on the connected robot with your launch options for ${parsed!.app}.`
                : "Run an image directly on the connected robot."
          }
          error={error ? { message: <span role="alert">{error}</span>, match: true } : undefined}
        >
          <InputGroup disabled={pending}>
            <InputGroup.Input
              name="image"
              aria-labelledby={labelId}
              placeholder="ghcr.io/koalbymqp/python-example:test-1"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={!!error}
            />
            <InputGroup.Addon align="end">
              <InputGroup.Button
                type="button"
                shape="square"
                icon={SlidersHorizontalIcon}
                aria-label="Launch options"
                title={parsed ? `Launch options for ${parsed.app}` : "Enter an image to set its launch options"}
                disabled={!parsed || pending}
                onClick={() => setOptionsOpen(true)}
              />
            </InputGroup.Addon>
            <InputGroup.Button
              type="submit"
              variant="primary"
              icon={pending ? <Spinner /> : undefined}
              disabled={!connection || !image || pending}
            >
              {pending ? "Starting…" : "Run image"}
            </InputGroup.Button>
          </InputGroup>
        </Field>
      </form>
      {/* Outside the form: the dialog has its own, and its submit would bubble into this one. */}
      {parsed && (
        <LaunchOptionsDialog app={parsed.app} name={parsed.name} open={optionsOpen} onOpenChange={setOptionsOpen} />
      )}
    </>
  );
}

function AppRow({ app }: { app: CatalogApp }) {
  const { connection } = useConnection();
  const { startApp, updateApp, pendingRuns, instances, busy } = useProject();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const latest = app.versions[0];
  const pending = app.versions.some((v) => pendingRuns.includes(v.url));
  const customized = hasLaunchOptions(useLaunchOptions(latest?.app ?? ""));
  const running = latest && instances.find((instance) => instance.app === latest.app && isLive(instance));
  const outdated = app.released && running && running.version !== latest.version ? running : null;
  const updating = !!outdated && busy[outdated.id] === "updating";
  const channel =
    app.channel ?? (latest ? getReleaseChannel({ name: app.name, tag_name: latest.version, prerelease: false }) : null);
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className="max-w-full truncate font-medium" title={app.name}>
          {app.name}
        </span>
        <Badge variant="secondary">{app.source}</Badge>
        {latest && (
          <Badge variant="outline" className="max-w-56 shrink">
            <span className="truncate" title={latest.version}>
              {latest.version}
              {channel && !latest.version.toLowerCase().includes(channel) ? ` (${channel})` : ""}
            </span>
          </Badge>
        )}
        <span className="text-(length:--kumo-font-size-xs)/[var(--tw-leading,var(--kumo-line-height-xs))] whitespace-nowrap text-kumo-subtle tabular-nums">
          {app.versions.length} {app.versions.length === 1 ? "version" : "versions"}
        </span>
        {app.installationKnown && (
          <span className="text-(length:--kumo-font-size-xs)/[var(--tw-leading,var(--kumo-line-height-xs))] text-kumo-subtle">
            {app.installed ? "Installed" : "Not installed"}
          </span>
        )}
        {customized && <Badge variant="outline">Custom options</Badge>}
      </div>
      {outdated && (
        <Button
          size="sm"
          icon={updating ? <Spinner size={12} /> : undefined}
          disabled={!connection || !!busy[outdated.id]}
          aria-label={`Update ${app.name} to ${latest.version}`}
          title={`Running ${outdated.version}. Replace it with ${latest.version}, keeping its options.`}
          onClick={() => void updateApp(outdated, latest)}
        >
          {updating ? "Updating…" : "Update"}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenu.Trigger>
          <Button
            variant="primary"
            size="sm"
            icon={pending ? <Spinner size={12} /> : undefined}
            disabled={!connection || !latest || pending}
            aria-label={`Run ${app.name}`}
            title={
              !connection ? "Connect to a robot to run apps" : !latest ? "No tagged versions available" : undefined
            }
          >
            {pending ? "Starting…" : "Run"}
            <CaretRightIcon />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" className="w-64">
          <DropdownMenu.Group>
            <DropdownMenu.Label>Run a version</DropdownMenu.Label>
            {app.versions.map((version) => (
              <DropdownMenu.Item key={version.url} onClick={() => void startApp(version)}>
                <span className="truncate">{version.version}</span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Group>
          <DropdownMenu.Separator />
          <DropdownMenu.Item icon={SlidersHorizontalIcon} onClick={() => setOptionsOpen(true)}>
            Launch options…
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
      {latest && (
        <LaunchOptionsDialog app={latest.app} name={app.name} open={optionsOpen} onOpenChange={setOptionsOpen} />
      )}
    </li>
  );
}

function CatalogList({
  apps,
  loading,
  emptyTitle,
  emptyDescription,
}: {
  apps: CatalogApp[];
  loading: boolean;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (loading)
    return (
      <div className="flex flex-col gap-3" aria-label="Loading apps">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-11 w-full rounded-lg" />
        ))}
      </div>
    );
  if (apps.length === 0)
    return (
      <Empty
        size="sm"
        icon={<PackageIcon size={28} className="text-kumo-subtle" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  return (
    <ul role="list" className="flex flex-col divide-y divide-kumo-hairline">
      {apps.map((app) => (
        <AppRow key={app.id} app={app} />
      ))}
    </ul>
  );
}

function CatalogCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const id = useId();
  return (
    <LayerCard render={<section aria-labelledby={id} />} className="min-w-0">
      <LayerCard.Secondary className="flex-wrap justify-between gap-x-4 gap-y-1">
        <h2 id={id} className="text-kumo-default">
          {title}
        </h2>
        <p className="text-(length:--kumo-font-size-sm)/[var(--tw-leading,var(--kumo-line-height-sm))] font-normal">
          {description}
        </p>
      </LayerCard.Secondary>
      <LayerCard.Primary className="gap-3 pr-4">{children}</LayerCard.Primary>
    </LayerCard>
  );
}

export default function AppsPage() {
  const { connection } = useConnection();
  const {
    actionError,
    notice,
    images,
    imagesLoading: loadingInstalled,
    imagesError: installedError,
    refresh: refreshRobot,
  } = useProject();
  const [releases, setReleases] = useState<ReleaseWithSource[]>([]);
  const [loadingOnline, setLoadingOnline] = useState(true);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [enabledSources, setEnabledSources] = useState<string[]>(Object.values(sources));
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getCombinedReleases(), getComponentsReleases()]).then((results) => {
      if (cancelled) return;
      setReleases(results.flatMap((r) => (r.status === "fulfilled" ? r.value.filter((v) => !v.draft) : [])));
      setOnlineError(
        results.some((r) => r.status === "rejected")
          ? "Some online apps could not be loaded. Refresh to try again."
          : null
      );
      setLoadingOnline(false);
    });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  const online = useMemo<CatalogApp[]>(
    () =>
      Object.entries(sources)
        .flatMap(([source, label]) =>
          groupReleasesByTitle(releases.filter((r) => r.source === source)).map((group) => {
            const versions = [...group.versions].sort(
              (a, b) => Date.parse(b.published_at) - Date.parse(a.published_at)
            );
            return {
              id: `${source}:${group.groupName}`,
              name: group.groupName,
              source: label,
              released: true,
              channel: getReleaseChannel(versions[0]),
              installed: images.some(
                (image) =>
                  appSlug(imageName(image.repository)) === appSlug(group.groupName) &&
                  runnableTags(image.tags).length > 0
              ),
              installationKnown: !!connection && !loadingInstalled && !installedError,
              versions: versions.map((version) => {
                const app = appSlug(group.groupName);
                const owner = version.repo.toLowerCase().split("/")[0];
                // Match docker/metadata-action's tag sanitization (e.g. startup/v1 -> startup-v1).
                const imageTag = version.tag_name.replace(/[^a-zA-Z0-9_.-]+/g, "-");
                return {
                  url: version.html_url,
                  name: group.groupName,
                  app,
                  version: version.tag_name,
                  image: `ghcr.io/${owner}/${app}:${imageTag}`,
                };
              }),
            };
          })
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [releases, images, connection, loadingInstalled, installedError]
  );

  const installed = useMemo<CatalogApp[]>(() => {
    const grouped = new Map<string, string[]>();
    for (const image of images) {
      if (image.repository === "<none>") continue;
      grouped.set(image.repository, [...(grouped.get(image.repository) ?? []), ...image.tags]);
    }
    return [...grouped]
      .map(([repository, tags]) => {
        const name = imageName(repository);
        const match = online.find((app) => appSlug(app.name) === appSlug(name));
        return {
          id: repository,
          name: match?.name ?? name,
          source: match?.source ?? "Local",
          versions: runnableTags(tags).map((tag) => ({
            name,
            app: appSlug(name),
            version: tag,
            url: `local:${repository}:${tag}`,
            image: `${repository}:${tag}`,
          })),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [images, online]);
  const matches = (app: CatalogApp) =>
    query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .every((word) => `${app.name} ${app.source}`.toLowerCase().includes(word));
  const filteredOnline = online.filter((app) => matches(app) && enabledSources.includes(app.source));
  const filteredInstalled = installed.filter(matches);

  function refresh() {
    setLoadingOnline(true);
    void refreshRobot();
    setRevision((r) => r + 1);
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">App Store</h1>
          <p className="text-kumo-subtle">Choose an app, pick a version, and run it on your robot.</p>
        </div>
        <Button icon={ArrowClockwiseIcon} onClick={refresh} disabled={loadingOnline || loadingInstalled}>
          Refresh
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <InputGroup className="max-w-sm">
          <InputGroup.Addon>
            <MagnifyingGlassIcon aria-hidden="true" />
          </InputGroup.Addon>
          <InputGroup.Input
            type="search"
            aria-label="Search apps"
            placeholder="Search apps…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </InputGroup>
        <DropdownMenu>
          <DropdownMenu.Trigger>
            <Button icon={FunnelIcon}>Sources</Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            <DropdownMenu.Group>
              <DropdownMenu.Label>Online repositories</DropdownMenu.Label>
              {Object.values(sources).map((source) => (
                <DropdownMenu.CheckboxItem
                  key={source}
                  checked={enabledSources.includes(source)}
                  onCheckedChange={(checked) =>
                    setEnabledSources((prev) => (checked ? [...prev, source] : prev.filter((s) => s !== source)))
                  }
                >
                  {source}
                </DropdownMenu.CheckboxItem>
              ))}
            </DropdownMenu.Group>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
      {actionError && <Banner role="alert" variant="error" icon={errorIcon} description={actionError} />}
      {notice && <Banner role="status" description={notice} />}
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <CatalogCard title="Online apps" description="Releases from Core, Apps, Drivers, Control, and Sensing.">
          <DirectImageForm />
          {onlineError && <Banner role="alert" variant="error" icon={errorIcon} description={onlineError} />}
          <CatalogList
            apps={filteredOnline}
            loading={loadingOnline}
            emptyTitle={query || enabledSources.length < 5 ? "No matching apps" : "No online apps"}
            emptyDescription="Try another search, adjust the sources, or refresh the catalog."
          />
        </CatalogCard>
        <CatalogCard
          title="Installed apps"
          description={
            connection?.devMode
              ? "Container images installed on this computer."
              : "Container images installed on the connected robot."
          }
        >
          {installedError && <Banner role="alert" variant="error" icon={errorIcon} description={installedError} />}
          <CatalogList
            apps={filteredInstalled}
            loading={loadingInstalled}
            emptyTitle={
              !connection ? "Connect to view installed apps" : query ? "No matching apps" : "No installed apps"
            }
            emptyDescription={
              !connection
                ? "Open the robot connection in the topbar, or choose Dev Mode for local apps."
                : "Run an online app to install its image, or build an image in your container runtime."
            }
          />
        </CatalogCard>
      </div>
    </div>
  );
}
