"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { Empty } from "@repo/ui/components/empty/empty";
import { Spinner } from "@repo/ui/components/spinner";
import {
  TerminalTab,
  TerminalTabPanel,
  TerminalTabs,
  TerminalTabsAction,
  TerminalTabsBar,
  TerminalTabsList,
} from "@repo/ui/components/terminal-tabs";
import { PlusIcon, TerminalWindowIcon } from "@repo/ui/icons";
import { useConnection } from "@/contexts/ConnectionContext";
import { robotBaseUrl, signedFetch } from "@/lib/robot-api";

const RobotTerminal = dynamic(async () => (await import("@/components/SSHTerminal")).default, {
  ssr: false,
  loading: () => (
    <div role="status" className="flex items-center gap-2 p-4 text-kumo-subtle">
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
    <TerminalTabs value={active} onValueChange={setActive}>
      <TerminalTabsBar>
        <TerminalTabsList aria-label="Terminal sessions">
          {sessions.map((session) => (
            <TerminalTab key={session.id} value={session.id}>
              {session.title}
            </TerminalTab>
          ))}
        </TerminalTabsList>
        <TerminalTabsAction onClick={addSession} disabled={!connection}>
          <PlusIcon aria-hidden="true" />
          New session
        </TerminalTabsAction>
      </TerminalTabsBar>
      {sessions.map((session) => (
        <TerminalTabPanel key={session.id} value={session.id} keepMounted>
          {connection ? (
            <RobotTerminal
              robotUrl={robotBaseUrl(connection)}
              signedFetch={fetchTerminal}
              onTitleChange={(title) =>
                setSessions((previous) => previous.map((item) => (item.id === session.id ? { ...item, title } : item)))
              }
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4 md:p-6">
              <Empty
                className="max-w-2xl"
                icon={<TerminalWindowIcon size={32} className="text-kumo-subtle" />}
                title="No robot connected"
                description="Open the robot connection in the topbar to connect or use Dev Mode."
              />
            </div>
          )}
        </TerminalTabPanel>
      ))}
    </TerminalTabs>
  );
}
