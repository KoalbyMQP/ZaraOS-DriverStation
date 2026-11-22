"use client";

import { forwardRef, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { Sidebar } from "@repo/ui/components/sidebar/sidebar";
import { TooltipProvider } from "@repo/ui/components/tooltip/tooltip";
import { LinkProvider, type LinkComponentProps } from "@repo/ui/lib/kumo/link-provider";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";

/** Routes every Kumo link (sidebar items, link buttons) through the Next.js router. */
const RouterLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(function RouterLink({ href, to, ...props }, ref) {
  return <Link ref={ref} href={href ?? to ?? ""} {...props} />;
});

// The sidebar and topbar share the canvas colour, as on the Cloudflare dashboard.
const shell = {
  "--sidebar-width": "257px",
  "--sidebar-bg": "var(--color-shell)",
  "--sidebar-active-bg": "var(--color-shell-active)",
} as CSSProperties;

export function DriverStationShell({ children }: { children: ReactNode }) {
  return (
    <LinkProvider component={RouterLink}>
      <TooltipProvider>
        <Sidebar.Provider collapsible="offcanvas" style={shell} className="h-dvh min-h-0! overflow-hidden">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Header />
            <main id="page-content" className="min-h-0 flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </Sidebar.Provider>
      </TooltipProvider>
    </LinkProvider>
  );
}
