"use client";

import { Empty } from "@repo/ui/kumo";
import { useConnection } from "@/contexts/ConnectionContext";

export default function HomePage() {
  const { connection } = useConnection();

  return (
    <div className="flex h-full items-center justify-center p-4 md:p-6">
      <Empty
        className="max-w-2xl"
        title="Driver Station"
        description={
          connection
            ? "You’re connected to a robot. Open an app from the sidebar."
            : "Connect to a robot and open an app from the sidebar."
        }
      />
    </div>
  );
}
