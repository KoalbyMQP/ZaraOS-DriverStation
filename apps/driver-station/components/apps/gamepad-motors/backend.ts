/**
 * Where the page hands off target positions. The page only calls `sendPositions`; the real
 * backend plugs in here once it exists.
 *
 * Status (2026-11-23): nothing usable yet. Core's `feat/interactive-demo-app` branch has a
 * `joint_mover_demo` app with a `zara_commands` command `move_joint(joint_name, position)` that
 * publishes one MotorMove to `/motor/move`. A page would reach it with
 * `services.command("move_joint", { joint_name, position })` (one call per motor, see
 * `lib/app-ui/types.ts`), but that needs Cortex's `POST /instances/{id}/command` (only on ZaraOS's
 * feat/69-cortex-command-endpoint and spike/app-interactivity-system branches), joint names for
 * the two motors, and a move time crab_api accepts (its README documents that moves over ~0.49 s
 * are rejected; the demo sends 2.5 s). The page doesn't await sends, so an adapter that can be
 * slower than 50 ms should drop superseded positions rather than queue them.
 */
export type MotorBackend = {
  /** Shown in the UI. */
  name: string;
  /** False while positions go nowhere; the page then says so. */
  connected: boolean;
  /** Move motor 1 and motor 2 to absolute positions in degrees. */
  sendPositions: (motor1: number, motor2: number) => Promise<void>;
};

/** Accepts positions and drops them: no network requests. */
export const noBackend: MotorBackend = {
  name: "None",
  connected: false,
  sendPositions: async () => {},
};
