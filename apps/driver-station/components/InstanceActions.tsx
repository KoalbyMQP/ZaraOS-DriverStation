"use client";

import { Button } from "@repo/ui/components/button/button";
import { Spinner } from "@repo/ui/components/spinner";
import { ArrowClockwiseIcon, StopIcon } from "@repo/ui/icons";
import { isLive, useProject } from "@/contexts/ProjectContext";
import type { RobotAppInstance } from "@/lib/robot-api";

/** Restart and stop controls for one app instance. */
export function InstanceActions({
  instance,
  onReplaced,
}: {
  instance: RobotAppInstance;
  /** A restart replaces the instance; called with the new instance's id. */
  onReplaced: (instanceId: string) => void;
}) {
  const { instances, busy, restartApp, stopApp } = useProject();
  const action = busy[instance.id];
  const live = isLive(instance);
  // Cortex runs one instance per app, so an old instance cannot start again beside a live one.
  const superseded = !live && instances.some((other) => other.app === instance.app && isLive(other));

  return (
    <div className="flex items-center gap-2">
      <Button
        icon={action === "restarting" ? <Spinner size={14} /> : ArrowClockwiseIcon}
        disabled={!!action || superseded}
        title={superseded ? "A newer instance of this app is running" : undefined}
        onClick={async () => {
          const id = await restartApp(instance);
          if (id) onReplaced(id);
        }}
      >
        {action === "restarting" ? "Restarting…" : live ? "Restart" : "Start again"}
      </Button>
      <Button
        variant="secondary-destructive"
        icon={action === "stopping" ? <Spinner size={14} /> : StopIcon}
        disabled={!!action || !live}
        onClick={() => void stopApp(instance)}
      >
        {action === "stopping" ? "Stopping…" : "Stop"}
      </Button>
    </div>
  );
}
