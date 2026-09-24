import type { ReactNode } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import ConnectionHealthMonitor from "@/components/ConnectionHealthMonitor";
import { ConnectionProvider } from "@/contexts/ConnectionContext";
import { ProjectProvider } from "@/contexts/ProjectContext";

export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <ConnectionProvider>
        <ProjectProvider>
          <ConnectionHealthMonitor />
          {children}
        </ProjectProvider>
      </ConnectionProvider>
    </AuthGuard>
  );
}
