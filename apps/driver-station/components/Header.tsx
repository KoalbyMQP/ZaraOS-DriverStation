"use client";

import { Button, LinkButton, useSidebar } from "@repo/ui/kumo";
import {
  BatteryVerticalHighIcon,
  CellSignalFullIcon,
  CpuIcon,
  DatabaseIcon,
  GraphicsCardIcon,
  MemoryIcon,
  SidebarSimpleIcon,
} from "@repo/ui/icons";
import { RobotConnectionControl } from "@/components/RobotConnectionControl";

const metrics = [
  { label: "Battery", icon: BatteryVerticalHighIcon },
  { label: "CPU", icon: CpuIcon },
  { label: "Memory", icon: MemoryIcon },
  { label: "Storage", icon: DatabaseIcon },
  { label: "GPU", icon: GraphicsCardIcon },
  { label: "Latency", icon: CellSignalFullIcon },
];

/**
 * Opens the navigation sheet on small screens. Kumo's Sidebar.Trigger toggles
 * whichever sidebar matches the viewport it last measured; a tap handled before
 * that measurement would collapse the desktop rail, which has no button to
 * bring it back. This one only ever drives the sheet.
 */
function MobileNavButton() {
  const { openMobile, setOpenMobile } = useSidebar();
  return (
    <Button
      variant="ghost"
      shape="square"
      aria-label="Toggle Sidebar"
      aria-expanded={openMobile}
      className="md:hidden"
      onClick={() => setOpenMobile(!openMobile)}
    >
      <SidebarSimpleIcon size={18} aria-hidden="true" />
    </Button>
  );
}

export function Header() {
  return (
    <header
      role="banner"
      className="flex min-h-[57px] shrink-0 flex-wrap items-center gap-2 border-b border-kumo-line bg-shell px-4 py-4 md:h-[57px] md:py-0"
    >
      <MobileNavButton />
      <RobotConnectionControl />
      <ul
        aria-label="Robot metrics"
        className="order-last flex w-full items-center justify-center gap-4 py-1 text-kumo-subtle lg:order-none lg:min-w-0 lg:flex-1 lg:py-0"
      >
        {metrics.map(({ label, icon: Icon }) => (
          <li key={label} className="flex items-center" aria-label={`${label}: unknown`} title={label}>
            <Icon className="size-4" aria-hidden="true" />
            <span className="font-mono text-[10px] leading-none tabular-nums">???</span>
          </li>
        ))}
      </ul>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <LinkButton href="/documentation" variant="ghost" size="sm">
          Documentation
        </LinkButton>
      </div>
    </header>
  );
}
