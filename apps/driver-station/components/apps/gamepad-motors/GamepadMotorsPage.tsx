"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Badge } from "@repo/ui/components/badge/badge";
import { Banner } from "@repo/ui/components/banner/banner";
import { Button } from "@repo/ui/components/button/button";
import { InputGroup } from "@repo/ui/components/input-group/input-group";
import { LayerCard } from "@repo/ui/components/layer-card/layer-card";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";
import { CheckIcon, GameControllerIcon, InfoIcon, LockSimpleIcon, LockSimpleOpenIcon } from "@repo/ui/icons";
import { noBackend, type MotorBackend } from "./backend";
import { createGamepadStore, type GamepadSnapshot, type Stick } from "./gamepad";
import {
  DEFAULT_DEADZONE,
  STEP_DEGREES,
  deflectionToPosition,
  formatDegrees,
  initialMappings,
  parseRange,
  roundToStep,
  stickDeflection,
  type Range,
  type StickMapping,
} from "./mapping";

/** At most this many sends per second, and only when a target changed. */
const SEND_HZ = 20;

const small = "text-(length:--kumo-font-size-sm)/[var(--tw-leading,var(--kumo-line-height-sm))]";
const tiny = "text-(length:--kumo-font-size-xs)/[var(--tw-leading,var(--kumo-line-height-xs))]";

const fieldError = (message: string | false | undefined) =>
  message ? { message: <span role="alert">{message}</span>, match: true as const } : undefined;

const motors = [
  { name: "Motor 1", stick: "Left stick", side: "left" },
  { name: "Motor 2", stick: "Right stick", side: "right" },
] as const;

/** Last position handed to the backend per motor, `null` before the first. */
type Sent = [number | null, number | null];

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <LayerCard>
      <LayerCard.Secondary className="flex-col items-start gap-0.5">
        <h2 className="text-kumo-default">{title}</h2>
        <p className={`${small} font-normal text-pretty`}>{description}</p>
      </LayerCard.Secondary>
      <LayerCard.Primary className="gap-5 pr-4">{children}</LayerCard.Primary>
    </LayerCard>
  );
}

/** Raw stick position, the deadzone, and the axis that drives the motor. */
function StickPad({
  stick,
  axis,
  deadzone,
  label,
}: {
  stick: Stick;
  axis: "x" | "y";
  deadzone: number;
  label: string;
}) {
  const r = 44;
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 112 112" className="size-28" role="img" aria-label={label}>
        <circle cx="56" cy="56" r={r} className="fill-kumo-base stroke-kumo-line" />
        <circle
          cx="56"
          cy="56"
          r={r * deadzone}
          className="fill-kumo-recessed stroke-kumo-line"
          strokeDasharray="2 3"
        />
        <path
          d={axis === "y" ? `M56 ${56 - r}V${56 + r}` : `M${56 - r} 56H${56 + r}`}
          className="stroke-kumo-brand/40"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle
          cx={56 + stick.x * r}
          cy={56 + stick.y * r}
          r="8"
          className="fill-kumo-brand stroke-kumo-base"
          strokeWidth="3"
        />
      </svg>
      <figcaption className={`${tiny} font-mono text-kumo-subtle tabular-nums`}>
        x {stick.x.toFixed(2)} · y {stick.y.toFixed(2)}
      </figcaption>
    </figure>
  );
}

const polar = (degrees: number, radius: number) => {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return `${(60 + radius * Math.cos(radians)).toFixed(2)} ${(60 + radius * Math.sin(radians)).toFixed(2)}`;
};

/** Target as a needle (0° up, like Motor control's preview) inside the allowed range's arc. */
function TargetDial({ degrees, range, label }: { degrees: number | null; range: Range | null; label: string }) {
  const arc =
    range && range.max - range.min < 360
      ? `M${polar(range.min, 46)}A46 46 0 ${range.max - range.min > 180 ? 1 : 0} 1 ${polar(range.max, 46)}`
      : null;
  return (
    <figure className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 120 120" className="size-28" aria-hidden="true">
        <circle cx="60" cy="60" r="52" className="fill-kumo-base stroke-kumo-line" />
        {arc ? (
          <path d={arc} className="fill-none stroke-kumo-brand/30" strokeWidth="8" />
        ) : (
          <circle cx="60" cy="60" r="46" className="fill-none stroke-kumo-brand/30" strokeWidth="8" />
        )}
        {degrees !== null && (
          <g transform={`rotate(${degrees % 360} 60 60)`} className="fill-none stroke-kumo-brand">
            <path d="M60 60V22" strokeWidth="4" strokeLinecap="round" />
          </g>
        )}
        <circle cx="60" cy="60" r="6" className="fill-kumo-brand stroke-kumo-base" strokeWidth="3" />
      </svg>
      <figcaption className="flex flex-col items-center gap-0.5">
        <span className="text-2xl font-medium tracking-tight tabular-nums" aria-label={label}>
          {degrees === null ? "—" : formatDegrees(degrees)}
        </span>
        <span className={`${tiny} text-kumo-subtle`}>
          {range ? `Target · ${formatDegrees(range.min)} to ${formatDegrees(range.max)}` : "Target · range invalid"}
        </span>
      </figcaption>
    </figure>
  );
}

/** Which stick direction counts as positive, worded for the selected axis. */
const directions = (axis: "x" | "y") =>
  axis === "y"
    ? [
        { invert: true, label: "Up = +" },
        { invert: false, label: "Down = +" },
      ]
    : [
        { invert: false, label: "Right = +" },
        { invert: true, label: "Left = +" },
      ];

/**
 * App-owned UI: drives two joints from an Xbox controller through the Gamepad API, or one joint at a
 * time by hand. It has no Next.js or Driver Station context dependencies: moves go to
 * `backend.moveJoint`, and `appPicker` (which instance the backend talks to) is rendered as given.
 */
export default function GamepadMotorsPage({
  backend = noBackend,
  appPicker,
}: {
  backend?: MotorBackend;
  appPicker?: ReactNode;
}) {
  const id = useId();
  const [store] = useState(createGamepadStore);
  const pad: GamepadSnapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [mappings, setMappings] = useState(initialMappings);
  const [deadzoneDraft, setDeadzoneDraft] = useState(String(DEFAULT_DEADZONE));
  const [sliderTargets, setSliderTargets] = useState<[number, number]>([0, 0]);
  const [jointNames, setJointNames] = useState<[string, string]>(["", ""]);
  // Armed for one controller generation and one backend only: connecting, disconnecting or swapping
  // the controller, or switching robot or instance, disarms without an effect and never re-arms.
  const [armedFor, setArmedFor] = useState<{ generation: number; backend: string } | null>(null);
  const [lastSent, setLastSent] = useState<Sent>([null, null]);
  const [sendTimes, setSendTimes] = useState<number[]>([]);
  const [sendCount, setSendCount] = useState(0);
  const [sendError, setSendError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  const deadzone = Number(deadzoneDraft);
  const deadzoneError =
    !deadzoneDraft.trim() || !Number.isFinite(deadzone) || deadzone < 0 || deadzone > 0.9
      ? "Enter a deadzone from 0 to 0.9."
      : null;
  const ranges = mappings.map((mapping) => parseRange(mapping));
  const validRanges = ranges.map((range) => (typeof range === "string" ? null : range));
  const sticks = [pad.left, pad.right];
  const usingController = pad.controller !== null;
  const deflections = mappings.map((mapping, motor) =>
    stickDeflection(sticks[motor]!, mapping, deadzoneError ? 0 : deadzone)
  );
  const targets = validRanges.map((range, motor) =>
    !range
      ? null
      : usingController
        ? deflectionToPosition(deflections[motor]!, range)
        : roundToStep(Math.min(range.max, Math.max(range.min, sliderTargets[motor]!)))
  );
  const armed = armedFor !== null && armedFor.generation === pad.generation && armedFor.backend === backend.id;
  // Joint names only matter once moves actually go somewhere; the local preview works without them.
  const jointErrors = jointNames.map((name, motor) =>
    !backend.connected
      ? null
      : !name.trim()
        ? "Enter the joint this motor drives."
        : motor === 1 && name.trim() === jointNames[0].trim()
          ? "Motor 1 already drives this joint."
          : null
  );
  const settingsError =
    deadzoneError ?? ranges.find((range) => typeof range === "string") ?? jointErrors.find((error) => error);
  const sticksCentred = deflections.every((deflection) => deflection === 0);
  const armBlocker = settingsError
    ? "Fix the settings to arm."
    : usingController && !sticksCentred
      ? "Centre both sticks to arm."
      : null;

  function arm() {
    if (armBlocker) return;
    setArmedFor({ generation: pad.generation, backend: backend.id });
    setSendError(null);
  }
  const disarm = () => setArmedFor(null);

  // A toggles arming, B always disarms. Edge-triggered: holding A doesn't flicker.
  const onButton = useRef<(button: "a" | "b") => void>(() => {});
  useEffect(() => {
    onButton.current = (button) => {
      if (button === "b" || armed) disarm();
      else arm();
    };
  });
  useEffect(() => store.onButton((button) => onButton.current(button)), [store]);

  // Losing focus stops rAF polling in most browsers, so the sticks would freeze: disarm instead.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") setArmedFor(null);
    };
    const onBlur = () => setArmedFor(null);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // While armed, check the targets SEND_HZ times a second and send one move per joint whose target
  // changed. The first check of each arming always sends, so the joints get the current targets.
  // Nothing queues: while a joint's move is in flight its newer targets wait, and the next check
  // after it settles sends only the latest one.
  const latest = useRef({ targets, jointNames, backend });
  useEffect(() => {
    latest.current = { targets, jointNames, backend };
  });
  useEffect(() => {
    if (!armed) return;
    let stopped = false;
    const requested: Sent = [null, null];
    const inFlight = [false, false];
    const check = () => {
      const { targets: current, jointNames: joints, backend: target } = latest.current;
      if (current[0] == null || current[1] == null) return;
      const at = performance.now();
      let sends = 0;
      current.forEach((position, motor) => {
        if (position == null || inFlight[motor] || requested[motor] === position) return;
        requested[motor] = position;
        inFlight[motor] = true;
        sends++;
        setLastSent((sent) => (motor === 0 ? [position, sent[1]] : [sent[0], position]));
        const joint = joints[motor]!.trim();
        target
          .moveJoint(joint, position)
          .catch((error: unknown) => {
            if (stopped) return;
            stopped = true;
            setArmedFor(null);
            setSendError(`${joint || motors[motor]!.name} to ${formatDegrees(position)}: ${describe(error)}`);
          })
          .finally(() => {
            inFlight[motor] = false;
          });
      });
      if (!sends) return;
      setSendCount((count) => count + sends);
      setSendTimes((times) => [...times.filter((time) => time > at - 1000), ...Array<number>(sends).fill(at)]);
      setNow(at);
    };
    const first = setTimeout(check, 0);
    const timer = setInterval(check, 1000 / SEND_HZ);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [armed, armedFor]);

  // Refresh the measured rate while armed so it falls back to zero when the sticks are still.
  useEffect(() => {
    if (!armed) return;
    const timer = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(timer);
  }, [armed]);
  const rate = armed ? sendTimes.filter((time) => time > now - 1000).length : 0;

  // Manual move: one move_joint call per click, never while the gamepad drives the joints.
  const [manualJoint, setManualJoint] = useState("");
  const [manualPosition, setManualPosition] = useState("0");
  const [manualBusy, setManualBusy] = useState(false);
  const [manualResult, setManualResult] = useState<{ ok: boolean; text: string } | null>(null);
  const manualDegrees = Number(manualPosition);
  const manualPositionError =
    !manualPosition.trim() || !Number.isFinite(manualDegrees) ? "Enter a position in degrees." : null;
  const manualBlocker = !backend.connected
    ? "Connect to a running joint mover app to send moves."
    : armed
      ? "Disarm the gamepad to move a joint by hand."
      : null;

  async function sendManual() {
    const joint = manualJoint.trim();
    if (manualBlocker || manualBusy || !joint || manualPositionError) return;
    setManualBusy(true);
    setManualResult(null);
    try {
      const reply = await backend.moveJoint(joint, manualDegrees);
      setManualResult({
        ok: true,
        text: `Sent ${joint} to ${formatDegrees(manualDegrees)}. The app replied ${JSON.stringify(reply)}.`,
      });
    } catch (error) {
      setManualResult({ ok: false, text: `${joint} to ${formatDegrees(manualDegrees)}: ${describe(error)}` });
    } finally {
      setManualBusy(false);
    }
  }

  function updateMapping(motor: number, change: Partial<StickMapping>) {
    setMappings(
      (current) =>
        current.map((mapping, index) => (index === motor ? { ...mapping, ...change } : mapping)) as [
          StickMapping,
          StickMapping,
        ]
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8" aria-labelledby={`${id}-title`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 id={`${id}-title`} className="text-2xl font-semibold tracking-tight text-balance">
            Gamepad motors
          </h1>
          <p className="text-pretty text-kumo-subtle">
            Drive two joints with an Xbox controller (the left stick moves motor 1, the right stick motor 2), or move
            one joint by hand.
          </p>
        </div>
        <Badge variant="outline">{backend.connected ? "Connected" : "UI preview"}</Badge>
      </header>

      {appPicker}
      {!backend.connected && (
        <Banner
          role="note"
          icon={<InfoIcon weight="fill" aria-hidden="true" />}
          title={backend.notice?.title ?? noBackend.notice!.title}
          description={backend.notice?.description ?? noBackend.notice!.description}
        />
      )}
      {sendError && <Banner variant="error" role="alert" title="Sending failed — disarmed" description={sendError} />}

      <Section
        title="Manual move"
        description="Move one joint to a position with a single move_joint call. A reply means the app accepted the move, not that the joint reached it."
      >
        <form
          className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_auto]"
          aria-label="Manual move"
          onSubmit={(event) => {
            event.preventDefault();
            void sendManual();
          }}
        >
          <InputGroup
            label={<span id={`${id}-manual-joint-label`}>Joint name</span>}
            description="As listed in the robot's bridge file, e.g. Shoulder."
            disabled={!!manualBlocker}
          >
            <InputGroup.Input
              aria-labelledby={`${id}-manual-joint-label`}
              value={manualJoint}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setManualJoint(event.target.value)}
            />
          </InputGroup>
          <InputGroup
            label={<span id={`${id}-manual-position-label`}>Position</span>}
            description="Absolute, in degrees."
            error={fieldError(manualPositionError ?? undefined)}
            disabled={!!manualBlocker}
          >
            <InputGroup.Input
              aria-labelledby={`${id}-manual-position-label`}
              type="number"
              step="any"
              value={manualPosition}
              onChange={(event) => setManualPosition(event.target.value)}
              aria-invalid={!!manualPositionError}
            />
            <InputGroup.Addon align="end">°</InputGroup.Addon>
          </InputGroup>
          <Button
            type="submit"
            variant="primary"
            className="h-10 sm:mt-6"
            disabled={!!manualBlocker || manualBusy || !manualJoint.trim() || !!manualPositionError}
            loading={manualBusy}
            aria-describedby={`${id}-manual-help`}
          >
            Move
          </Button>
        </form>
        {manualBlocker && (
          <p id={`${id}-manual-help`} className={`${small} text-kumo-subtle`}>
            {manualBlocker}
          </p>
        )}
        {manualResult &&
          (manualResult.ok ? (
            <p role="status" aria-label="Manual move result" className={`${small} wrap-anywhere text-kumo-success`}>
              {manualResult.text}
            </p>
          ) : (
            <Banner variant="error" role="alert" title="Move failed" description={manualResult.text} />
          ))}
      </Section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section title="Controller" description="Uses the first connected gamepad with the standard mapping.">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-kumo-recessed">
              <GameControllerIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col gap-1" role="status" aria-label="Controller status">
              {pad.controller ? (
                <>
                  <span className="font-medium wrap-anywhere">{pad.controller.id}</span>
                  <span className={`${small} text-kumo-subtle`}>
                    Gamepad {pad.controller.index}
                    {pad.controller.standard ? " · standard mapping" : " · non-standard mapping, axes may differ"}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium">No controller</span>
                  <span className={`${small} text-kumo-subtle`}>
                    Connect an Xbox controller and press any button. Until then, use the sliders below.
                  </span>
                </>
              )}
            </div>
          </div>
          <dl className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 ${small}`}>
            <dt>
              <kbd className="rounded bg-kumo-recessed px-1.5 font-mono">A</kbd>
            </dt>
            <dd className="text-kumo-subtle">Arm or disarm (sticks must be centred to arm)</dd>
            <dt>
              <kbd className="rounded bg-kumo-recessed px-1.5 font-mono">B</kbd>
            </dt>
            <dd className="text-kumo-subtle">Disarm</dd>
          </dl>
          <InputGroup
            label={<span id={`${id}-deadzone-label`}>Deadzone</span>}
            description="Stick deflection ignored around the centre, from 0 to 0.9."
            error={fieldError(deadzoneError ?? undefined)}
            disabled={armed}
          >
            <InputGroup.Input
              aria-labelledby={`${id}-deadzone-label`}
              type="number"
              min="0"
              max="0.9"
              step="0.05"
              value={deadzoneDraft}
              onChange={(event) => setDeadzoneDraft(event.target.value)}
              aria-invalid={!!deadzoneError}
            />
          </InputGroup>
        </Section>

        <Section
          title="Output"
          description={`One move_joint call per joint whose target changed, at most ${SEND_HZ} times a second per joint.`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              {armed ? (
                <Badge variant="success" appearance="dot" className="w-fit">
                  Armed
                </Badge>
              ) : (
                <Badge variant="neutral" appearance="dot" className="w-fit">
                  Disarmed
                </Badge>
              )}
              <p id={`${id}-arm-help`} className={`${small} text-kumo-subtle`}>
                {armed
                  ? "Targets follow the controls. Releasing a stick returns its motor to the middle of its range."
                  : (armBlocker ??
                    "Nothing is sent while disarmed. Arming sends the current targets at once, so centred sticks move both motors to the middle of their ranges.")}
              </p>
            </div>
            {armed ? (
              <Button variant="destructive" size="lg" className="h-11" icon={LockSimpleIcon} onClick={disarm}>
                Disarm
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                className="h-11"
                icon={LockSimpleOpenIcon}
                disabled={!!armBlocker}
                aria-describedby={`${id}-arm-help`}
                onClick={arm}
              >
                Arm
              </Button>
            )}
          </div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3">
            <dt className="text-kumo-subtle">Last sent</dt>
            <dd className="text-right tabular-nums" aria-label="Last sent">
              {lastSent.every((sent) => sent === null)
                ? "—"
                : lastSent.map((sent) => (sent === null ? "—" : formatDegrees(sent))).join(" · ")}
            </dd>
            <dt className="text-kumo-subtle">Updates sent</dt>
            <dd className="text-right tabular-nums">{sendCount}</dd>
            <dt className="text-kumo-subtle">Send rate</dt>
            <dd className="text-right tabular-nums">
              {rate}/s <span className="text-kumo-subtle">· limit {SEND_HZ}/s per joint</span>
            </dd>
            <dt className="text-kumo-subtle">Backend</dt>
            <dd className="text-right wrap-anywhere">{backend.connected ? backend.name : "None — not sent"}</dd>
          </dl>
        </Section>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {motors.map((motor, index) => {
          const mapping = mappings[index]!;
          const range = validRanges[index] ?? null;
          const rangeError = typeof ranges[index] === "string" ? ranges[index] : undefined;
          return (
            <Section
              key={motor.name}
              title={`${motor.name} · ${motor.stick}`}
              description={`${mapping.axis.toUpperCase()} axis, ${directions(mapping.axis)
                .find((d) => d.invert === mapping.invert)!
                .label.toLowerCase()}.`}
            >
              <div className="flex flex-wrap items-center justify-around gap-4 rounded-lg bg-kumo-recessed px-4 py-5">
                <StickPad
                  stick={sticks[index]!}
                  axis={mapping.axis}
                  deadzone={deadzoneError ? 0 : deadzone}
                  label={`${motor.stick} position`}
                />
                <TargetDial degrees={targets[index] ?? null} range={range} label={`${motor.name} target`} />
              </div>

              {!usingController && range && (
                <div className="grid gap-2">
                  <label htmlFor={`${id}-manual-${index}`} className="font-medium">
                    {motor.name} target (no controller)
                  </label>
                  <input
                    id={`${id}-manual-${index}`}
                    type="range"
                    min={range.min}
                    max={range.max}
                    step={STEP_DEGREES}
                    value={targets[index] ?? 0}
                    onChange={(event) =>
                      setSliderTargets((current) =>
                        index === 0
                          ? [Number(event.target.value), current[1]]
                          : [current[0], Number(event.target.value)]
                      )
                    }
                    className="w-full accent-kumo-brand"
                  />
                </div>
              )}

              <div className="grid items-start gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <InputGroup
                    label={<span id={`${id}-joint-${index}`}>Joint name</span>}
                    description={backend.connected ? undefined : "Needed once a robot is connected."}
                    error={fieldError(jointErrors[index] ?? undefined)}
                    disabled={armed}
                  >
                    <InputGroup.Input
                      aria-labelledby={`${id}-joint-${index}`}
                      value={jointNames[index]}
                      placeholder={index === 0 ? "e.g. Shoulder" : "e.g. Hip"}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(event) =>
                        setJointNames((current) =>
                          index === 0 ? [event.target.value, current[1]] : [current[0], event.target.value]
                        )
                      }
                      aria-invalid={!!jointErrors[index]}
                    />
                  </InputGroup>
                </div>
                <div className="grid gap-2">
                  <span id={`${id}-axis-${index}`} className="font-medium">
                    Axis
                  </span>
                  <ToggleGroup
                    aria-labelledby={`${id}-axis-${index}`}
                    value={[mapping.axis]}
                    disabled={armed}
                    onValueChange={(values) => {
                      const axis = values[0];
                      if (axis === "x" || axis === "y") updateMapping(index, { axis, invert: axis === "y" });
                    }}
                  >
                    {(["y", "x"] as const).map((axis) => (
                      <ToggleGroupItem key={axis} value={axis} className="h-10 px-3">
                        <CheckIcon aria-hidden="true" className="opacity-0 group-data-pressed/toggle:opacity-100" />
                        {axis === "y" ? "Up / down" : "Left / right"}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                <div className="grid gap-2">
                  <span id={`${id}-direction-${index}`} className="font-medium">
                    Direction
                  </span>
                  <ToggleGroup
                    aria-labelledby={`${id}-direction-${index}`}
                    value={[String(mapping.invert)]}
                    disabled={armed}
                    onValueChange={(values) => {
                      if (values[0] === "true" || values[0] === "false")
                        updateMapping(index, { invert: values[0] === "true" });
                    }}
                  >
                    {directions(mapping.axis).map((direction) => (
                      <ToggleGroupItem key={direction.label} value={String(direction.invert)} className="h-10 px-3">
                        <CheckIcon aria-hidden="true" className="opacity-0 group-data-pressed/toggle:opacity-100" />
                        {direction.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                {(["minDegrees", "maxDegrees"] as const).map((key) => (
                  <InputGroup
                    key={key}
                    label={
                      <span id={`${id}-${key}-${index}`}>{key === "minDegrees" ? "Minimum" : "Maximum"} angle</span>
                    }
                    error={key === "maxDegrees" ? fieldError(rangeError) : undefined}
                    disabled={armed}
                  >
                    <InputGroup.Input
                      aria-labelledby={`${id}-${key}-${index}`}
                      type="number"
                      step="any"
                      value={mapping[key]}
                      onChange={(event) => updateMapping(index, { [key]: event.target.value })}
                      aria-invalid={!!rangeError}
                    />
                    <InputGroup.Addon align="end">°</InputGroup.Addon>
                  </InputGroup>
                ))}
              </div>
              <p className={`${tiny} leading-relaxed text-kumo-subtle`}>
                The range is a UI default, not a hardware limit. Joint bounds will come from the motor app. Settings are
                locked while armed.
              </p>
            </Section>
          );
        })}
      </div>
    </section>
  );
}
