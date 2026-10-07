"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@repo/ui/components/input-group";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@repo/ui/components/item";
import { Skeleton } from "@repo/ui/components/skeleton";
import { Spinner } from "@repo/ui/components/spinner";
import { ArrowClockwiseIcon, CaretRightIcon, FunnelIcon, MagnifyingGlassIcon, PackageIcon } from "@repo/ui/icons";
import { useConnection } from "@/contexts/ConnectionContext";
import { appSlug, useProject, type AppLaunch } from "@/contexts/ProjectContext";
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
};

function DirectImageForm() {
  const { connection } = useConnection();
  const { startApp, pendingRuns } = useProject();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const image = value.trim();
  const url = `image:${image}`;
  const pending = pendingRuns.includes(url);

  function runImage() {
    if (!connection || !image || pending) return;
    const [repository = "", digest] = image.split("@");
    // Read the tag from the last path segment so registry ports stay intact.
    const [name = "", tag] = (repository.split("/").at(-1) ?? "").split(":");
    const app = appSlug(name);
    if (!app || /\s|:\/\//.test(image) || tag === "" || digest === "") {
      setError("Enter an image reference such as ghcr.io/koalbymqp/python-example:test-1, without https://.");
      return;
    }
    setError(null);
    void startApp({ url, name, app, version: digest ?? tag ?? "latest", image });
  }

  return (
    <form
      aria-label="Run container image"
      onSubmit={(event) => {
        event.preventDefault();
        runImage();
      }}
    >
      <FieldGroup>
        <Field data-invalid={!!error} data-disabled={pending}>
          <FieldLabel htmlFor="container-image">Container image</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="container-image"
              name="image"
              placeholder="ghcr.io/koalbymqp/python-example:test-1"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={pending}
              aria-invalid={!!error}
              aria-describedby={error ? "container-image-error" : "container-image-help"}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton type="submit" variant="default" disabled={!connection || !image || pending}>
                {pending && <Spinner data-icon="inline-start" aria-hidden="true" />}
                {pending ? "Starting…" : "Run image"}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          <FieldDescription id="container-image-help">
            {connection ? "Run an image directly on the connected robot." : "Connect to a robot to run an image."}
          </FieldDescription>
          {error && <FieldError id="container-image-error">{error}</FieldError>}
        </Field>
      </FieldGroup>
    </form>
  );
}

function AppRow({ app }: { app: CatalogApp }) {
  const { connection } = useConnection();
  const { startApp, pendingRuns } = useProject();
  const latest = app.versions[0];
  const pending = app.versions.some((v) => pendingRuns.includes(v.url));
  const channel =
    app.channel ?? (latest ? getReleaseChannel({ name: app.name, tag_name: latest.version, prerelease: false }) : null);
  return (
    <Item role="listitem" size="sm" className="flex-nowrap">
      <ItemContent className="min-w-0 flex-row flex-wrap items-center gap-2">
        <ItemTitle className="max-w-full truncate" title={app.name}>
          {app.name}
        </ItemTitle>
        <Badge variant="secondary">{app.source}</Badge>
        {latest && (
          <Badge variant="outline" className="max-w-full truncate" title={latest.version}>
            {latest.version}
            {channel && !latest.version.toLowerCase().includes(channel) ? ` (${channel})` : ""}
          </Badge>
        )}
        <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {app.versions.length} {app.versions.length === 1 ? "version" : "versions"}
        </span>
        {app.installationKnown && (
          <span className="text-xs text-muted-foreground">{app.installed ? "Installed" : "Not installed"}</span>
        )}
      </ItemContent>
      <ItemActions className="ml-auto shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="sm"
                disabled={!connection || !latest || pending}
                aria-label={`Run ${app.name}`}
                title={
                  !connection ? "Connect to a robot to run apps" : !latest ? "No tagged versions available" : undefined
                }
              />
            }
          >
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? "Starting…" : "Run"}
            <CaretRightIcon data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Run a version</DropdownMenuLabel>
              {app.versions.map((version) => (
                <DropdownMenuItem key={version.url} onClick={() => void startApp(version)}>
                  <span className="truncate">{version.version}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ItemActions>
    </Item>
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
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  if (apps.length === 0)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageIcon />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <ItemGroup className="gap-1">
      {apps.map((app) => (
        <AppRow key={app.id} app={app} />
      ))}
    </ItemGroup>
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
          <p className="text-sm text-muted-foreground">Choose an app, pick a version, and run it on your robot.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loadingOnline || loadingInstalled}>
          <ArrowClockwiseIcon data-icon="inline-start" />
          Refresh
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <InputGroup className="max-w-sm">
          <InputGroupAddon>
            <MagnifyingGlassIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label="Search apps"
            placeholder="Search apps…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </InputGroup>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>
            <FunnelIcon data-icon="inline-start" />
            Sources
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Online repositories</DropdownMenuLabel>
              {Object.values(sources).map((source) => (
                <DropdownMenuCheckboxItem
                  key={source}
                  checked={enabledSources.includes(source)}
                  onCheckedChange={(checked) =>
                    setEnabledSources((prev) => (checked ? [...prev, source] : prev.filter((s) => s !== source)))
                  }
                >
                  {source}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert role="status">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card className="min-w-0 bg-white">
          <CardHeader>
            <CardTitle>
              <h2>Online apps</h2>
            </CardTitle>
            <CardDescription>Releases from Core, Apps, Drivers, Control, and Sensing.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <DirectImageForm />
            {onlineError && (
              <Alert variant="destructive">
                <AlertDescription>{onlineError}</AlertDescription>
              </Alert>
            )}
            <CatalogList
              apps={filteredOnline}
              loading={loadingOnline}
              emptyTitle={query || enabledSources.length < 5 ? "No matching apps" : "No online apps"}
              emptyDescription="Try another search, adjust the sources, or refresh the catalog."
            />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>
              <h2>Installed apps</h2>
            </CardTitle>
            <CardDescription>
              {connection?.devMode
                ? "Container images installed on this computer."
                : "Container images installed on the connected robot."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {installedError && (
              <Alert variant="destructive">
                <AlertDescription>{installedError}</AlertDescription>
              </Alert>
            )}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
