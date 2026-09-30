"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Kbd } from "@repo/ui/components/kbd";
import {
  AppStoreIcon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  ComputerTerminal01Icon,
  DashboardSquare01Icon,
  HugeiconsIcon,
  Search01Icon,
  Settings02Icon,
} from "@repo/ui/icons";
import { cn } from "@repo/ui/lib/utils";
import { useProject } from "@/contexts/ProjectContext";

const robotLinks = [
  { href: "/", label: "Dashboards", icon: DashboardSquare01Icon },
  { href: "/console", label: "Terminals", icon: ComputerTerminal01Icon },
  { href: "/apps", label: "App Store", icon: AppStoreIcon },
  { href: "https://example.com", label: "Settings", icon: Settings02Icon },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { activeProjects } = useProject();

  return (
    <aside className="flex min-h-0 flex-col gap-2 overflow-y-auto border-b border-sidebar-border bg-sidebar p-2 text-sidebar-foreground md:border-r md:border-b-0">
      <div className="relative">
        <HugeiconsIcon
          icon={Search01Icon}
          className="pointer-events-none absolute top-2 left-2 size-4 text-muted-foreground"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <Input aria-label="Search" placeholder="Search..." className="h-8 bg-background pr-12 pl-8" />
        <Kbd className="pointer-events-none absolute top-1.5 right-2" aria-hidden="true">
          ⌘K
        </Kbd>
      </div>
      <nav aria-label="Robot">
        <h2 className="flex h-8 items-center px-2 text-xs font-medium text-muted-foreground">Robot</h2>
        <ul className="grid grid-cols-2 gap-1 md:grid-cols-1">
          {robotLinks.map(({ href, label, icon }) => (
            <li key={label}>
              <Button
                variant="ghost"
                nativeButton={false}
                role="link"
                render={<Link href={href} />}
                aria-current={pathname === href ? "page" : undefined}
                className={cn(
                  "h-9 w-full justify-start gap-2 px-2 font-normal md:h-8",
                  pathname === href && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
              >
                <HugeiconsIcon icon={icon} strokeWidth={1.5} aria-hidden="true" />
                <span className="flex-1 text-left">{label}</span>
                {label !== "Terminals" && (
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={1.5} aria-hidden="true" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label="Running apps">
        <h2 className="flex h-8 items-center px-2 text-xs font-medium text-muted-foreground">Apps</h2>
        {activeProjects.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {activeProjects.map((project) => (
              <li key={project.url}>
                <Button
                  variant="ghost"
                  nativeButton={false}
                  role="link"
                  render={<Link href={{ pathname: "/logs", query: { app: project.name, version: project.version } }} />}
                  title={`${project.name} ${project.version}`}
                  className="h-8 w-full justify-start gap-2 px-2 font-normal"
                >
                  <Badge className="gap-1 rounded-full border-transparent bg-green-600 px-2 text-white">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3" aria-hidden="true" />
                    OK
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-left">{project.name}</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={1.5} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-2 py-1 text-xs leading-5 text-muted-foreground">No running apps.</p>
        )}
      </nav>
    </aside>
  );
}
