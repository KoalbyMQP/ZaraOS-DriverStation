"use client";

import Image from "next/image";
import { Button } from "@repo/ui/components/button";
import {
  BatteryMedium02Icon,
  CellularNetworkIcon,
  CpuIcon,
  Database01Icon,
  GpuIcon,
  HugeiconsIcon,
  Moon02Icon,
  RamMemoryIcon,
} from "@repo/ui/icons";
import { AccountMenu } from "@/components/AccountMenu";
import { RobotConnectionControl } from "@/components/RobotConnectionControl";

const metrics = [
  { label: "Battery", icon: BatteryMedium02Icon },
  { label: "CPU", icon: CpuIcon },
  { label: "Memory", icon: RamMemoryIcon },
  { label: "Storage", icon: Database01Icon },
  { label: "GPU", icon: GpuIcon },
  { label: "Latency", icon: CellularNetworkIcon },
];

export function Header() {
  return (
    <header className="flex min-h-14 min-w-0 flex-wrap items-center gap-x-2 gap-y-2 border-b border-border bg-sidebar px-4 py-2">
      <RobotConnectionControl />
      <ul
        aria-label="Robot metrics"
        className="order-last flex w-full items-center justify-center gap-4 py-1 text-muted-foreground xl:order-none xl:min-w-0 xl:flex-1 xl:py-0"
      >
        {metrics.map(({ label, icon }) => (
          <li key={label} className="flex items-center gap-0.5" aria-label={`${label}: unknown`} title={label}>
            <HugeiconsIcon icon={icon} className="size-4" strokeWidth={1.5} aria-hidden="true" />
            <span className="font-mono text-[10px] leading-none tabular-nums">???</span>
          </li>
        ))}
      </ul>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button
          variant="secondary"
          size="xs"
          nativeButton={false}
          role="link"
          render={<a href="https://example.com" />}
        >
          Documentation
        </Button>
        <Button variant="secondary" size="icon-xs" disabled aria-label="Dark mode (unavailable)">
          <HugeiconsIcon icon={Moon02Icon} strokeWidth={1.5} aria-hidden="true" />
        </Button>
        <Button size="xs" nativeButton={false} role="link" render={<a href="https://example.com" />}>
          Settings
        </Button>
        <AccountMenu />
      </div>
    </header>
  );
}
