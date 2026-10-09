"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { Button } from "@repo/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@repo/ui/components/empty";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@repo/ui/components/tabs";
import { Spinner } from "@repo/ui/components/spinner";
import { PlusIcon, TerminalWindowIcon } from "@repo/ui/icons";
import { useConnection } from "@/contexts/ConnectionContext";
import { robotBaseUrl, signedFetch } from "@/lib/robot-api";

const RobotTerminal = dynamic(async () => (await import("@/components/SSHTerminal")).default, {
  ssr: false,
  loading: () => (
    <div role="status" className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
      <Spinner />
      Opening terminal…
    </div>
  ),
});

export default function ConsolePage() {
  const { connection } = useConnection();
  const [sessions, setSessions] = useState([{ id: "1", title: "Terminal" }]);
  const [active, setActive] = useState<string | null>("1");
  const fetchTerminal = useCallback(
    (url: string, init?: RequestInit) => {
      if (!connection) return Promise.reject(new Error("No robot connected"));
      return signedFetch(connection, init?.method ?? "GET", new URL(url).pathname, init?.body as string | undefined);
    },
    [connection]
  );

  function addSession() {
    const id = crypto.randomUUID();
    setSessions((previous) => [...previous, { id, title: `Terminal ${previous.length + 1}` }]);
    setActive(id);
  }

  return (
    <Tabs value={active} onValueChange={setActive} className="h-full min-h-80 gap-0">
      <div className="flex h-[41px] shrink-0 overflow-x-auto bg-sidebar">
        <TabsList variant="terminal" aria-label="Terminal sessions" className="w-auto shrink-0">
          {sessions.map((session) => (
            <TabsTrigger key={session.id} value={session.id}>
              {session.title}
            </TabsTrigger>
          ))}
        </TabsList>
        <Button variant="terminal" size="terminal" onClick={addSession} disabled={!connection}>
          <PlusIcon data-icon="inline-start" />
          New session
        </Button>
      </div>
      {sessions.map((session) => (
        <TabsContent
          key={session.id}
          value={session.id}
          keepMounted
          className="min-h-0 overflow-hidden data-hidden:hidden [[inert]]:hidden"
        >
          {connection ? (
            <RobotTerminal
              robotUrl={robotBaseUrl(connection)}
              signedFetch={fetchTerminal}
              onTitleChange={(title) =>
                setSessions((previous) => previous.map((item) => (item.id === session.id ? { ...item, title } : item)))
              }
            />
          ) : (
            <Empty className="h-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <TerminalWindowIcon />
                </EmptyMedia>
                <EmptyTitle>No robot connected</EmptyTitle>
                <EmptyDescription>Open the robot connection in the topbar to connect or use Dev Mode.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
