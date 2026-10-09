"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Badge } from "@repo/ui/components/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@repo/ui/components/collapsible";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@repo/ui/components/input-group";
import { Kbd } from "@repo/ui/components/kbd";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarSeparator,
  SidebarMenuSkeleton,
  useSidebar,
} from "@repo/ui/components/sidebar";
import {
  HouseIcon,
  TerminalWindowIcon,
  AppStoreLogoIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  CaretRightIcon,
  SlidersHorizontalIcon,
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

function AppStatus({ state }: { state: string }) {
  if (state === "running")
    return (
      <Badge variant="success">
        <CheckCircleIcon />
        OK
      </Badge>
    );
  if (["error", "failed"].includes(state))
    return (
      <Badge variant="error">
        <WarningCircleIcon />
        Error
      </Badge>
    );
  if (state === "starting" || state === "stopping")
    return <Badge variant="secondary">{state === "starting" ? "Starting" : "Stopping"}</Badge>;
  if (state === "unknown") return <Badge variant="outline">Unknown</Badge>;
  return <Badge variant="off">Off</Badge>;
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
      <SidebarMenuSubItem key={id}>
        <SidebarMenuSubButton
          render={<Link href={id ? { pathname: path, query: { page: id } } : path} />}
          isActive={active}
          aria-current={active ? "page" : undefined}
          onClick={closeMobile}
        >
          <span>
            {instance.version} · {page.title}
          </span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
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
    <Sidebar className="border-shell-border">
      <SidebarHeader className="h-14 shrink-0 justify-center p-4">
        <Link
          href="/"
          aria-label="Driver Station"
          onClick={closeMobile}
          className="w-fit rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Image src="/icons/android-head.png" width={41} height={24} alt="" unoptimized />
        </Link>
      </SidebarHeader>
      <SidebarSeparator className="mx-0 bg-shell-border" />
      <SidebarContent className="gap-2 p-2">
        <InputGroup className="shrink-0">
          <InputGroupAddon>
            <MagnifyingGlassIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            ref={searchInput}
            aria-label="Search navigation"
            aria-keyshortcuts="Meta+K Control+K"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <InputGroupAddon align="inline-end">
            <Kbd>{shortcut}</Kbd>
          </InputGroupAddon>
        </InputGroup>
        <SidebarGroup className="gap-2 p-0">
          <SidebarGroupLabel>Robot</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Robot">
              <SidebarMenu className="gap-1">
                {robotLinks
                  .filter(({ label }) => matches(label))
                  .map(({ href, label, icon: Icon }) => (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        render={<Link href={href} />}
                        isActive={pathname === href}
                        aria-current={pathname === href ? "page" : undefined}
                        onClick={closeMobile}
                      >
                        <Icon aria-hidden="true" />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="gap-2 p-0">
          <SidebarGroupLabel>Apps</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Apps">
              <SidebarMenu className="gap-1">
                {matches("Motor control") && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href="/motor-control" />}
                      isActive={pathname === "/motor-control"}
                      aria-current={pathname === "/motor-control" ? "page" : undefined}
                      onClick={closeMobile}
                    >
                      <SlidersHorizontalIcon aria-hidden="true" />
                      <span>Motor control</span>
                      <Badge variant="outline" className="ml-auto">
                        Preview
                      </Badge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {imagesLoading ? (
                  <SidebarMenuItem>
                    <SidebarMenuSkeleton />
                  </SidebarMenuItem>
                ) : (
                  apps
                    .filter((app) => matches(app.name))
                    .map((app) => (
                      <Collapsible key={app.repository} render={<SidebarMenuItem />}>
                        <CollapsibleTrigger
                          render={<SidebarMenuButton />}
                          aria-label={`${app.name}: ${loading || error ? "status unavailable" : app.state}`}
                          className="group/app"
                        >
                          <AppStatus state={loading || error ? "unknown" : app.state} />
                          <span className="min-w-0 flex-1 truncate text-left">{app.name}</span>
                          <CaretRightIcon className="group-data-panel-open/app:rotate-90" aria-hidden="true" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {app.instances.map((instance) => (
                              <AppPageLinks
                                key={`ui-${instance.id}`}
                                instanceId={instance.id}
                                closeMobile={closeMobile}
                              />
                            ))}
                            {app.instances.map((instance) => (
                              <SidebarMenuSubItem key={instance.id}>
                                <SidebarMenuSubButton
                                  render={
                                    <Link
                                      href={{
                                        pathname: "/logs",
                                        query: { instance: instance.id, app: instance.app, version: instance.version },
                                      }}
                                    />
                                  }
                                  onClick={closeMobile}
                                >
                                  <span>{instance.version} · Logs</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton render={<Link href="/appstore" />} onClick={closeMobile}>
                                <span>Open in App Store</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </Collapsible>
                    ))
                )}
              </SidebarMenu>
              {imagesError ? (
                <p role="status" className="px-2 py-1 text-xs text-muted-foreground">
                  Could not load installed apps.
                </p>
              ) : (
                !imagesLoading &&
                apps.length === 0 && (
                  <p className="px-2 py-1 text-xs text-muted-foreground">
                    {connection ? "No installed apps." : "Connect to view installed apps."}
                  </p>
                )
              )}
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
