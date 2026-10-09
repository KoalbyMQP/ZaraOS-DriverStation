"use client";

import { Component, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Empty, EmptyHeader, EmptyTitle } from "@repo/ui/components/empty";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useConnection } from "@/contexts/ConnectionContext";
import { useAppUi, useInstanceUi } from "@/contexts/AppUiContext";
import type { AppUiDescriptor } from "@/lib/app-ui/schema";
import type { AppPageProps, AppServices } from "@/lib/app-ui/types";
import { createAppServices } from "@/lib/app-ui/services";

function Failure({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <Alert>
      <AlertDescription>{message}</AlertDescription>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          Retry
        </Button>
      )}
    </Alert>
  );
}

class PageBoundary extends Component<{ children: ReactNode; retry: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Failure message="This App page could not be displayed." retry={this.props.retry} />
    ) : (
      this.props.children
    );
  }
}

function RemotePage({
  descriptor,
  pageId,
  instanceId,
  retry,
}: {
  descriptor: AppUiDescriptor;
  pageId: string;
  instanceId: string;
  retry: () => void;
}) {
  const { connection } = useConnection();
  const [loaded, setLoaded] = useState<
    { View: ComponentType<AppPageProps>; services: AppServices } | { error: string } | null
  >(null);
  useEffect(() => {
    if (!connection) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      controller.abort();
      setLoaded({ error: "The App page took too long to load." });
    }, 20000);
    // Keep federation execution out of Next's server rendering.
    void import("@/lib/app-ui/runtime")
      .then(({ loadAppPage }) => loadAppPage(descriptor, pageId))
      .then((module) => {
        if (!controller.signal.aborted)
          setLoaded({ View: module.default, services: createAppServices(connection, instanceId, controller.signal) });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setLoaded({ error: error instanceof Error ? error.message : "The App page could not be loaded." });
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [connection, descriptor, pageId, instanceId]);
  if (loaded && "error" in loaded) return <Failure message={loaded.error} retry={retry} />;
  if (!loaded) return <Skeleton className="h-64 w-full" aria-label="Loading App page" />;
  return <loaded.View instanceId={instanceId} services={loaded.services} />;
}

export function AppPage({ instanceId, pageId }: { instanceId: string; pageId?: string }) {
  const { instance, descriptor, loading, error } = useInstanceUi(instanceId);
  const { retry } = useAppUi();
  const [attempt, setAttempt] = useState(0);
  if (loading) return <Skeleton className="h-64 w-full" aria-label="Loading App UI" />;
  if (error || !descriptor || !instance) return <Failure message={error ?? "App UI is unavailable."} retry={retry} />;
  const selected = pageId ?? Object.keys(descriptor.pages)[0];
  if (!selected)
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyTitle>This App has no pages.</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  if (!Object.hasOwn(descriptor.pages, selected)) return <Failure message="This App page is unavailable." />;
  if (instance.state !== "running")
    return <Failure message={`This App is ${instance.state}. Start it to use this page.`} />;
  const retryPage = () => setAttempt((value) => value + 1);
  return (
    <PageBoundary
      key={JSON.stringify([instanceId, descriptor.federation, selected, descriptor.pages[selected].module, attempt])}
      retry={retryPage}
    >
      <RemotePage descriptor={descriptor} pageId={selected} instanceId={instanceId} retry={retryPage} />
    </PageBoundary>
  );
}
