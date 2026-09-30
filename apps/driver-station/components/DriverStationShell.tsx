import type { ReactNode } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";

export function DriverStationShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-background text-foreground md:h-dvh md:grid-cols-[256px_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)] md:overflow-hidden">
      <Link
        href="/"
        className="hidden items-center border-r border-b border-sidebar-border bg-sidebar px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring md:flex"
      >
        Driver Station
      </Link>
      <Header />
      <AppSidebar />
      <main id="page-content" className="min-h-0 min-w-0 overflow-auto bg-background">
        {children}
      </main>
    </div>
  );
}
