"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Banner, Empty, Select } from "@repo/ui/kumo";
import { Skeleton } from "@repo/ui/components/skeleton";
import { WarningCircleIcon } from "@repo/ui/icons";
import { useConnection } from "@/contexts/ConnectionContext";
import { appSlug, useProject } from "@/contexts/ProjectContext";
import { LogViewer } from "@/components/LogViewer";

export default function LogsPage() {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-80 w-auto rounded-lg" />}>
      <ProjectLogs />
    </Suspense>
  );
}

function ProjectLogs() {
  const params = useSearchParams();
  return (
    <LogsView
      key={params.toString()}
      requestedId={params.get("instance")}
      requestedApp={params.get("app")}
      requestedVersion={params.get("version")}
    />
  );
}

function LogsView({
  requestedId,
  requestedApp,
  requestedVersion,
}: {
  requestedId: string | null;
  requestedApp: string | null;
  requestedVersion: string | null;
}) {
  const { connection } = useConnection();
  const { instances, loading, error } = useProject();
  const [selected, setSelected] = useState<string | null>(null);
  const requested = instances.find(
    (i) =>
      (!requestedId || i.id === requestedId) &&
      (!requestedApp || i.app === requestedApp || i.app === appSlug(requestedApp)) &&
      (!requestedVersion || i.version === requestedVersion)
  );
  const selectedId = instances.some((i) => i.id === selected) ? selected : (requested?.id ?? null);
  const items = instances.map((i) => ({ value: i.id, label: `${i.app} · ${i.version}` }));

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">App logs</h1>
      {error && <Banner role="alert" variant="error" icon={<WarningCircleIcon weight="fill" />} description={error} />}
      {!connection || (!loading && instances.length === 0) ? (
        <Empty
          title={connection ? "No app instances" : "No robot connected"}
          description={
            connection
              ? "Start an app from the App Store to view its logs."
              : "Open the robot connection in the topbar to view logs."
          }
        />
      ) : loading ? (
        <Skeleton className="h-80 w-full rounded-lg" />
      ) : (
        <>
          <div className="max-w-sm">
            <Select
              label="App instance"
              placeholder="Select an instance"
              className="w-full"
              items={items}
              value={selectedId}
              onValueChange={setSelected}
            />
          </div>
          {selectedId ? (
            <LogViewer key={selectedId} connection={connection} instanceId={selectedId} />
          ) : (
            <Empty title="Select an instance" description="Choose an app above to view its logs." />
          )}
        </>
      )}
    </div>
  );
}
