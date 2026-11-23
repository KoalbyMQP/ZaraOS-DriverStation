"use client";

import { useState } from "react";
import { Select } from "@repo/ui/components/select/select";
import { useConnection } from "@/contexts/ConnectionContext";
import { useProject } from "@/contexts/ProjectContext";
import GamepadMotorsPage from "./GamepadMotorsPage";
import { JOINT_MOVER_APP, isJointMoverInstance, jointMoverBackend, noBackend, type MotorBackend } from "./backend";

/**
 * Connects the gamepad motors page to the robot: finds the running joint mover instances in the
 * Driver Station's instance list and sends moves to the one picked here.
 */
export default function JointMoverGamepad() {
  const { connection } = useConnection();
  const { instances, loading, error } = useProject();
  const [picked, setPicked] = useState<string | null>(null);

  const candidates = instances.filter(isJointMoverInstance);
  const instance = candidates.find((i) => i.id === picked) ?? candidates[0] ?? null;

  const notice = !connection
    ? {
        title: "No robot connected — moves are not sent",
        description:
          "Arming and targets work locally so you can try the controls. Connect to a robot running the joint mover app to move motors.",
      }
    : loading
      ? { title: "Looking for the joint mover app…", description: "Moves are not sent until it is found." }
      : error
        ? { title: "Could not list the robot's apps — moves are not sent", description: error }
        : {
            title: "Joint mover app not running — moves are not sent",
            description: `Start ${JOINT_MOVER_APP} from the App Store. Arming and targets work locally in the meantime.`,
          };
  const backend: MotorBackend =
    connection && instance ? jointMoverBackend(connection, instance.id, instance.app) : { ...noBackend, notice };

  const picker =
    candidates.length > 0 ? (
      <div className="max-w-md">
        <Select
          label="Joint mover instance"
          className="w-full"
          items={candidates.map((i) => ({ value: i.id, label: `${i.app} · ${i.version} · ${i.id}` }))}
          value={instance?.id ?? null}
          onValueChange={(value) => setPicked(value as string | null)}
        />
      </div>
    ) : null;

  return <GamepadMotorsPage backend={backend} appPicker={picker} />;
}
