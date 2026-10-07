import type { ReactNode } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import ConnectionHealthMonitor from "@/components/ConnectionHealthMonitor";
import { ConnectionProvider } from "@/contexts/ConnectionContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { AppUiProvider } from "@/contexts/AppUiContext";
import { DriverStationShell } from "@/components/DriverStationShell";

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <ConnectionProvider>
        <ProjectProvider>
          <AppUiProvider>
            <ConnectionHealthMonitor />
            <DriverStationShell>{children}</DriverStationShell>
          </AppUiProvider>
        </ProjectProvider>
      </ConnectionProvider>
    </AuthGuard>
  );
}
