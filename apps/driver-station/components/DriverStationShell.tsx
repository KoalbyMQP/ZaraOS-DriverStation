import type { CSSProperties, ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";
import { TooltipProvider } from "@repo/ui/components/tooltip";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";

export function DriverStationShell({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider
        style={{ "--sidebar-width": "257px" } as CSSProperties}
        className="h-dvh min-h-0 overflow-hidden"
      >
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-hidden">
          <Header />
          <div id="page-content" className="min-h-0 flex-1 overflow-auto">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
