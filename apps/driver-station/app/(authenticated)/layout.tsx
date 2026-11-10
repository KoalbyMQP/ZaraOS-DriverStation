import type { ReactNode } from "react";
import ConnectionHealthMonitor from "@/components/ConnectionHealthMonitor";
import { ConnectionProvider } from "@/contexts/ConnectionContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { AppUiProvider } from "@/contexts/AppUiContext";
import { DriverStationShell } from "@/components/DriverStationShell";

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider>
      <ProjectProvider>
        <AppUiProvider>
          <ConnectionHealthMonitor />
          <DriverStationShell>{children}</DriverStationShell>
        </AppUiProvider>
      </ProjectProvider>
    </ConnectionProvider>
  );
}
