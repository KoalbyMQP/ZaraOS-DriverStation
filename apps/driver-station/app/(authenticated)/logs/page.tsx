"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@repo/ui/components/empty";
import { Field, FieldLabel } from "@repo/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/select";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useConnection } from "@/contexts/ConnectionContext";
import { appSlug, useProject } from "@/contexts/ProjectContext";
import { LogViewer } from "@/components/LogViewer";

export default function LogsPage() {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-80" />}>
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
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!connection || (!loading && instances.length === 0) ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{connection ? "No app instances" : "No robot connected"}</EmptyTitle>
            <EmptyDescription>
              {connection
                ? "Start an app from the App Store to view its logs."
                : "Open the robot connection in the topbar to view logs."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : loading ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <>
          <Field className="max-w-sm">
            <FieldLabel htmlFor="log-instance">App instance</FieldLabel>
            <Select items={items} value={selectedId} onValueChange={setSelected}>
              <SelectTrigger id="log-instance">
                <SelectValue placeholder="Select an instance" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {selectedId ? (
            <LogViewer key={selectedId} connection={connection} instanceId={selectedId} />
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Select an instance</EmptyTitle>
                <EmptyDescription>Choose an app above to view its logs.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </>
      )}
    </div>
  );
}
