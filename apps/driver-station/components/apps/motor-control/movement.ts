/** Local UI values, not an HTTP payload. The app's endpoint contract is still pending. */
export type Movement = {
  joint: string;
  angleDegrees: number;
  durationMs: number;
  ledColor: "green" | "blue" | "red";
};

export type MovementDraft = Omit<Movement, "angleDegrees" | "durationMs"> & {
  angleDegrees: string;
  durationMs: string;
};

export const initialMovement: MovementDraft = {
  joint: "",
  angleDegrees: "0",
  durationMs: "1000",
  ledColor: "blue",
};

export function validateMovement(draft: MovementDraft) {
  const errors: Partial<Record<keyof MovementDraft, string>> = {};
  if (!draft.joint.trim()) errors.joint = "Enter a joint name.";
  if (!draft.angleDegrees.trim() || !Number.isFinite(Number(draft.angleDegrees)))
    errors.angleDegrees = "Enter a finite target angle in degrees.";
  if (!draft.durationMs.trim() || !Number.isSafeInteger(Number(draft.durationMs)) || Number(draft.durationMs) <= 0)
    errors.durationMs = "Enter a whole number of milliseconds greater than zero.";
  // Hardware joint bounds and movement-time limits must come from the eventual app API.
  return errors;
}
