import type { Connection } from "@/contexts/ConnectionContext";
import { AppRequestError, createAppServices } from "@/lib/app-ui/services";
import { robotBaseUrl, type RobotAppInstance } from "@/lib/robot-api";

/**
 * Where the page sends moves. The page only calls `moveJoint`; which robot and app instance it
 * reaches is decided by whoever builds the backend (see `JointMoverGamepad.tsx`).
 *
 * The real backend is Core's `joint_mover_demo` app (branch `feat/interactive-demo-app`): a
 * `zara_commands` command `move_joint(joint_name: str, position: float)` that publishes one
 * MotorMove (position in degrees, fixed 2.5 s move time) to crab_api's `/motor/move` and replies
 * `{"joint": joint_name, "target": position}`. The reply only means the app published the move:
 * crab_api only logs an unknown joint, and the firmware rejects a goal outside the joint's bounds;
 * neither comes back to the caller.
 * It is reached through Cortex's `POST /instances/{id}/command` (ZaraOS
 * spike/app-interactivity-system), which older Cortex builds don't have.
 */
export type MotorBackend = {
  /** Which robot and instance moves go to. Arming lasts only while this stays the same. */
  id: string;
  /** Shown in the UI. */
  name: string;
  /** False while moves go nowhere; the page then shows `notice`. */
  connected: boolean;
  /** Why moves are not sent, when not connected. */
  notice?: { title: string; description: string };
  /** Move one joint to an absolute position in degrees. Resolves with the app's reply. */
  moveJoint: (jointName: string, position: number) => Promise<unknown>;
};

/** Accepts moves and drops them: no network requests. */
export const noBackend: MotorBackend = {
  id: "none",
  name: "None",
  connected: false,
  notice: {
    title: "Not connected — moves are not sent",
    description:
      "Arming and targets work locally so you can try the controls. Motors move once a robot running the joint mover app is connected.",
  },
  moveJoint: async () => null,
};

export const JOINT_MOVER_APP = "joint_mover_demo";
const JOINT_MOVER_IMAGE = "joint-mover-demo";
export const MOVE_JOINT_COMMAND = "move_joint";

/** Running instances of the joint mover app, by app name (`joint_mover_demo`) or image (`…/joint-mover-demo`). */
export function isJointMoverInstance(instance: RobotAppInstance) {
  if (instance.state !== "running") return false;
  const app = instance.app.toLowerCase().replaceAll("-", "_");
  // "ghcr.io/koalbymqp/joint-mover-demo:v1@sha256:…" → "joint-mover-demo"
  const repository = (instance.image ?? "").toLowerCase().split("@")[0]!.split("/").pop()!.split(":")[0];
  return app === JOINT_MOVER_APP || repository === JOINT_MOVER_IMAGE;
}

/** A never-aborted lifetime: a move that already left is not worth cancelling. */
const forever = new AbortController().signal;

/**
 * Ask a joint mover instance to move one joint. Sends
 * `POST /instances/{instanceId}/command` with `{"command": "move_joint", "args": {"joint_name", "position"}}`
 * and resolves with the app's `result`; rejects with a message fit to show.
 */
export async function moveJoint(
  connection: Connection,
  instanceId: string,
  jointName: string,
  position: number,
  signal?: AbortSignal
): Promise<unknown> {
  if (!jointName.trim()) throw new Error("Enter a joint name.");
  if (!Number.isFinite(position)) throw new Error("Enter a finite position in degrees.");
  try {
    return await createAppServices(connection, instanceId, forever).command(
      MOVE_JOINT_COMMAND,
      { joint_name: jointName.trim(), position },
      { signal }
    );
  } catch (error) {
    throw new Error(describeMoveError(error), { cause: error });
  }
}

function describeMoveError(error: unknown) {
  if (error instanceof AppRequestError) {
    // Cortex builds without the command route answer with their catch-all `{"error": "not found"}`
    // (develop) or Go's plain-text "404 page not found". A missing instance ("instance not found")
    // or an unknown command ("unknown command: move_joint") explains itself instead.
    if (error.status === 404 && (!error.explained || error.message === "not found"))
      return "This robot's Cortex doesn't support app commands yet.";
    return `${error.message} (HTTP ${error.status})`;
  }
  if (error instanceof TypeError) return `Could not reach the robot: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}

/** A backend bound to one running joint mover instance. */
export function jointMoverBackend(connection: Connection, instanceId: string, app: string): MotorBackend {
  return {
    id: `${robotBaseUrl(connection)} ${instanceId}`,
    name: `${app} · ${instanceId}`,
    connected: true,
    moveJoint: (jointName, position) => moveJoint(connection, instanceId, jointName, position),
  };
}
