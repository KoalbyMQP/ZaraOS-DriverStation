"use client";

import { useConnection } from "@/contexts/ConnectionContext";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@repo/ui/components/empty";

export default function HomePage() {
  const connection = useConnection();

  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyTitle>Driver Station</EmptyTitle>
        <EmptyDescription>
          {connection.connection ? (
            <>
              You&apos;re connected to a robot.
              <br />
              Open an app from the sidebar.
            </>
          ) : (
            <>Connect to a robot and open an app from the sidebar.</>
          )}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
