"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Badge } from "@repo/ui/components/badge/badge";
import { InputGroup } from "@repo/ui/components/input-group/input-group";
import { Sidebar, useSidebar } from "@repo/ui/components/sidebar/sidebar";
import { Kbd } from "@repo/ui/components/kbd";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  HouseIcon,
  TerminalWindowIcon,
  AppStoreLogoIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  WarningCircleIcon,
} from "@repo/ui/icons";
import { useProject } from "@/contexts/ProjectContext";
import { useConnection } from "@/contexts/ConnectionContext";
import { installedApps } from "@/lib/installed-apps";
import { useInstanceUi } from "@/contexts/AppUiContext";

const subscribePlatform = () => () => {};
const platformShortcut = () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘K" : "Ctrl K");

const robotLinks = [
  { href: "/", label: "Home", icon: HouseIcon },
  { href: "/console", label: "Terminals", icon: TerminalWindowIcon },
  { href: "/appstore", label: "App Store", icon: AppStoreLogoIcon },
];

// Kumo sets navigation rows in 13px medium; the shell design uses 14px regular.
const navText = "text-base font-normal";

function AppStatus({ state }: { state: string }) {
  if (state === "running")
    return (
      <Badge variant="green" icon={<CheckCircleIcon weight="fill" />}>
        OK
      </Badge>
    );
  if (["error", "failed"].includes(state))
    return (
      <Badge variant="red" icon={<WarningCircleIcon weight="fill" />}>
        Error
      </Badge>
    );
  if (state === "starting" || state === "stopping")
    return <Badge variant="secondary">{state === "starting" ? "Starting" : "Stopping"}</Badge>;
  if (state === "unknown") return <Badge variant="outline">Unknown</Badge>;
  return <Badge variant="neutral">Off</Badge>;
}

function AppPageLinks({ instanceId, closeMobile }: { instanceId: string; closeMobile: () => void }) {
  const { instance, descriptor } = useInstanceUi(instanceId);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (!instance?.ui?.descriptor_url) return null;
  const path = `/app/${encodeURIComponent(instanceId)}`;
  const pages = Object.entries(descriptor?.pages ?? { "": { title: "Interface" } });
  return pages.map(([id, page]) => {
    const active = pathname === path && (searchParams.get("page") ?? pages[0]?.[0]) === id;
    return (
      <Sidebar.MenuSubButton
        key={id}
        href={id ? `${path}?${new URLSearchParams({ page: id })}` : path}
        active={active}
        aria-current={active ? "page" : undefined}
        onClick={closeMobile}
        className={navText}
      >
        {`${instance.version} · ${page.title}`}
      </Sidebar.MenuSubButton>
    );
  });
}

export function AppSidebar() {
  const pathname = usePathname();
  const { connection } = useConnection();
  const { images, instances, imagesLoading, imagesError, loading, error } = useProject();
  const { setOpenMobile, isMobile } = useSidebar();
  const [search, setSearch] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const shortcut = useSyncExternalStore(subscribePlatform, platformShortcut, () => "⌘K");
  const matches = (name: string) => name.toLowerCase().includes(search.trim().toLowerCase());
  const closeMobile = () => setOpenMobile(false);
  const apps = installedApps(images, instances);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      if (isMobile) setOpenMobile(true);
      requestAnimationFrame(() => searchInput.current?.focus());
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [isMobile, setOpenMobile]);

  return (
    <Sidebar className="max-md:not-data-[mobile=true]:hidden">
      <Sidebar.Header className="h-[57px] px-4">
        <Link
          href="/"
          aria-label="Driver Station"
          onClick={closeMobile}
          className="w-fit rounded-sm focus-visible:outline-2 focus-visible:outline-kumo-brand"
        >
          <Image src="/icons/android-head.png" width={41} height={24} alt="" unoptimized />
        </Link>
      </Sidebar.Header>
      <div className="shrink-0 px-2 pt-2">
        <InputGroup>
          <InputGroup.Addon>
            <MagnifyingGlassIcon aria-hidden="true" />
          </InputGroup.Addon>
          <InputGroup.Input
            ref={searchInput}
            aria-label="Search navigation"
            aria-keyshortcuts="Meta+K Control+K"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Kbd className="mr-2 shrink-0">{shortcut}</Kbd>
        </InputGroup>
      </div>
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.GroupLabel>Robot</Sidebar.GroupLabel>
          <nav aria-label="Robot">
            <Sidebar.Menu>
              {robotLinks
                .filter(({ label }) => matches(label))
                .map(({ href, label, icon }) => (
                  <Sidebar.MenuButton
                    key={href}
                    href={href}
                    icon={icon}
                    active={pathname === href}
                    aria-current={pathname === href ? "page" : undefined}
                    onClick={closeMobile}
                    className={navText}
                  >
                    {label}
                  </Sidebar.MenuButton>
                ))}
            </Sidebar.Menu>
          </nav>
        </Sidebar.Group>
        <Sidebar.Group>
          <Sidebar.GroupLabel>Apps</Sidebar.GroupLabel>
          <nav aria-label="Apps">
            {imagesLoading ? (
              <div aria-hidden="true" className="flex min-h-8.5 items-center gap-3 px-3">
                <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
                <Skeleton className="h-2.5 w-28 rounded-full" />
              </div>
            ) : (
              <Sidebar.Menu>
                {/* Motor control preview, hidden for now:
                {matches("Motor control") && (
                  <Sidebar.MenuButton
                    href="/motor-control"
                    icon={SlidersHorizontalIcon}
                    active={pathname === "/motor-control"}
                    aria-current={pathname === "/motor-control" ? "page" : undefined}
                    onClick={closeMobile}
                    className={navText}
                  >
                    Motor control
                    <Sidebar.MenuBadge>Preview</Sidebar.MenuBadge>
                  </Sidebar.MenuButton>
                )} */}
                {apps
                  .filter((app) => matches(app.name))
                  .map((app) => (
                    <Sidebar.MenuItem key={app.repository}>
                      <Sidebar.Collapsible>
                        <Sidebar.CollapsibleTrigger
                          render={
                            <Sidebar.MenuButton
                              icon={<AppStatus state={loading || error ? "unknown" : app.state} />}
                              aria-label={`${app.name}: ${loading || error ? "status unavailable" : app.state}`}
                              className={navText}
                            >
                              {app.name}
                              <Sidebar.MenuChevron />
                            </Sidebar.MenuButton>
                          }
                        />
                        <Sidebar.CollapsibleContent>
                          <Sidebar.MenuSub>
                            {app.instances.map((instance) => (
                              <AppPageLinks
                                key={`ui-${instance.id}`}
                                instanceId={instance.id}
                                closeMobile={closeMobile}
                              />
                            ))}
                            {app.instances.map((instance) => (
                              <Sidebar.MenuSubButton
                                key={instance.id}
                                href={`/logs?${new URLSearchParams({
                                  instance: instance.id,
                                  app: instance.app,
                                  version: instance.version,
                                })}`}
                                onClick={closeMobile}
                                className={navText}
                              >
                                {`${instance.version} · Logs`}
                              </Sidebar.MenuSubButton>
                            ))}
                            <Sidebar.MenuSubButton href="/appstore" onClick={closeMobile} className={navText}>
                              Open in App Store
                            </Sidebar.MenuSubButton>
                          </Sidebar.MenuSub>
                        </Sidebar.CollapsibleContent>
                      </Sidebar.Collapsible>
                    </Sidebar.MenuItem>
                  ))}
              </Sidebar.Menu>
            )}
            {imagesError ? (
              <p role="status" className="px-3 py-1 text-xs text-kumo-subtle">
                Could not load installed apps.
              </p>
            ) : (
              !imagesLoading &&
              apps.length === 0 && (
                <p className="px-3 py-1 text-xs text-kumo-subtle">
                  {connection ? "No installed apps." : "Connect to view installed apps."}
                </p>
              )
            )}
          </nav>
        </Sidebar.Group>
      </Sidebar.Content>
    </Sidebar>
  );
}
