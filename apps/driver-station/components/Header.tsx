"use client";

import Link from "next/link";
import { Button } from "@repo/ui/components/button";
import { SidebarTrigger } from "@repo/ui/components/sidebar";
import {
  BatteryVerticalHighIcon,
  CellSignalFullIcon,
  CpuIcon,
  DatabaseIcon,
  GraphicsCardIcon,
  MemoryIcon,
} from "@repo/ui/icons";
import { AccountMenu } from "@/components/AccountMenu";
import { RobotConnectionControl } from "@/components/RobotConnectionControl";

const metrics = [
  { label: "Battery", icon: BatteryVerticalHighIcon },
  { label: "CPU", icon: CpuIcon },
  { label: "Memory", icon: MemoryIcon },
  { label: "Storage", icon: DatabaseIcon },
  { label: "GPU", icon: GraphicsCardIcon },
  { label: "Latency", icon: CellSignalFullIcon },
];

export function Header() {
  return (
    <header
      role="banner"
      className="flex min-h-[57px] shrink-0 flex-wrap items-center gap-2 border-b border-shell-border bg-sidebar px-4 py-4 md:h-[57px] md:py-0"
    >
      <SidebarTrigger className="md:hidden" />
      <RobotConnectionControl />
      <ul
        aria-label="Robot metrics"
        className="order-last flex w-full items-center justify-center gap-4 py-1 text-muted-foreground lg:order-none lg:min-w-0 lg:flex-1 lg:py-0"
      >
        {metrics.map(({ label, icon: Icon }) => (
          <li key={label} className="flex items-center" aria-label={`${label}: unknown`} title={label}>
            <Icon className="size-4" aria-hidden="true" />
            <span className="font-mono text-[10px] leading-none tabular-nums">???</span>
          </li>
        ))}
      </ul>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="xs" nativeButton={false} role="link" render={<Link href="/documentation" />}>
          Documentation
        </Button>
        <AccountMenu />
      </div>
    </header>
  );
}
