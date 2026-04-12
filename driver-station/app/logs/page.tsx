"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useConnection } from "@/contexts/ConnectionContext";
import { Header } from "@/components/Header";
import { LogViewer } from "@/components/LogViewer";
import { getInstances, type RobotAppInstance } from "@/lib/robot-api";

export default function LogsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { connection } = useConnection();
  const [instances, setInstances] = useState<RobotAppInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
    null
  );
  const [loadingInstances, setLoadingInstances] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/authenticate");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!connection) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear list when disconnected
      setInstances([]);
      setLoadingInstances(false);
      return;
    }

    const fetchInstances = () => {
      getInstances(connection)
        .then((data) => {
          setInstances(data.instances);
          if (data.instances.length > 0 && !selectedInstanceId) {
            setSelectedInstanceId(data.instances[0].id);
          }
        })
        .catch(() => setInstances([]))
        .finally(() => setLoadingInstances(false));
    };

    fetchInstances();
    const interval = setInterval(fetchInstances, 30000);
    return () => clearInterval(interval);
  }, [connection, selectedInstanceId]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header />
      <main className="p-6">
        {!connection ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-6 text-center text-sm text-zinc-400">
            No robot connected. Use the Connect button in the header to view logs.
          </div>
        ) : loadingInstances ? (
          <div className="flex items-center justify-center py-12 text-zinc-400">
            Loading instances...
          </div>
        ) : instances.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-6 text-center text-sm text-zinc-400">
            No running instances. Start an app from the Apps page to view logs.
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Instance list */}
            <div className="w-48 flex-shrink-0">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900">
                <div className="border-b border-zinc-800 px-4 py-3">
                  <h3 className="font-medium text-zinc-100">Instances</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {instances.map((instance) => (
                    <button
                      key={instance.id}
                      onClick={() => setSelectedInstanceId(instance.id)}
                      className={`w-full border-b border-zinc-800 px-4 py-3 text-left text-sm transition-colors ${
                        selectedInstanceId === instance.id
                          ? "bg-blue-900/30 text-blue-300"
                          : "text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      <div className="font-mono text-xs text-zinc-500">
                        {instance.id.slice(0, 8)}
                      </div>
                      <div className="font-medium">{instance.app}</div>
                      <div className="text-xs text-zinc-500">
                        v{instance.version}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Log viewer */}
            <div className="flex-1">
              {selectedInstanceId ? (
                <LogViewer
                  key={selectedInstanceId}
                  connection={connection}
                  instanceId={selectedInstanceId}
                />
              ) : (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-6 text-center text-sm text-zinc-400">
                  Select an instance to view logs
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
