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

type Sent = { motor1: number; motor2: number };

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
 * App-owned UI: drives two motors from an Xbox controller through the Gamepad API. It has no
 * Next.js or Driver Station context dependencies; positions go to `backend.sendPositions`.
 */
export default function GamepadMotorsPage({ backend = noBackend }: { backend?: MotorBackend }) {
  const id = useId();
  const [store] = useState(createGamepadStore);
  const pad: GamepadSnapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [mappings, setMappings] = useState(initialMappings);
  const [deadzoneDraft, setDeadzoneDraft] = useState(String(DEFAULT_DEADZONE));
  const [manual, setManual] = useState<[number, number]>([0, 0]);
  // Armed for one controller generation only: connecting, disconnecting or swapping the controller
  // changes the generation, which disarms without an effect and can never re-arm by itself.
  const [armedFor, setArmedFor] = useState<{ generation: number } | null>(null);
  const [lastSent, setLastSent] = useState<Sent | null>(null);
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
        : roundToStep(Math.min(range.max, Math.max(range.min, manual[motor]!)))
  );
  const armed = armedFor !== null && armedFor.generation === pad.generation;
  const settingsError = deadzoneError ?? ranges.find((range) => typeof range === "string");
  const sticksCentred = deflections.every((deflection) => deflection === 0);
  const armBlocker = settingsError
    ? "Fix the settings to arm."
    : usingController && !sticksCentred
      ? "Centre both sticks to arm."
      : null;

  function arm() {
    if (armBlocker) return;
    setArmedFor({ generation: pad.generation });
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

  // While armed, check the targets SEND_HZ times a second and send them only if they changed. The
  // first check of each arming always sends, so the motors get the current targets.
  const latest = useRef(targets);
  useEffect(() => {
    latest.current = targets;
  });
  useEffect(() => {
    if (!armed) return;
    let sent: Sent | null = null;
    const check = () => {
      const [motor1, motor2] = latest.current;
      if (motor1 == null || motor2 == null || (sent && sent.motor1 === motor1 && sent.motor2 === motor2)) return;
      sent = { motor1, motor2 };
      const at = performance.now();
      setLastSent(sent);
      setSendCount((count) => count + 1);
      setSendTimes((times) => [...times.filter((time) => time > at - 1000), at]);
      setNow(at);
      backend.sendPositions(motor1, motor2).catch((error: unknown) => {
        setArmedFor(null);
        setSendError(error instanceof Error ? error.message : String(error));
      });
    };
    const first = setTimeout(check, 0);
    const timer = setInterval(check, 1000 / SEND_HZ);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [armed, armedFor, backend]);

  // Refresh the measured rate while armed so it falls back to zero when the sticks are still.
  useEffect(() => {
    if (!armed) return;
    const timer = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(timer);
  }, [armed]);
  const rate = armed ? sendTimes.filter((time) => time > now - 1000).length : 0;

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
            Drive two motors with an Xbox controller: the left stick moves motor 1, the right stick motor 2.
          </p>
        </div>
        <Badge variant="outline">UI preview</Badge>
      </header>

      {!backend.connected && (
        <Banner
          role="note"
          icon={<InfoIcon weight="fill" aria-hidden="true" />}
          title="No backend yet — positions are not sent"
          description="Arming and targets work locally so you can try the controls. Motors will not move until the motor app is connected."
        />
      )}
      {sendError && <Banner variant="error" role="alert" title="Sending failed — disarmed" description={sendError} />}

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
          description={`Absolute positions, sent at most ${SEND_HZ} times a second and only when a target changes.`}
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
              {lastSent ? `${formatDegrees(lastSent.motor1)} · ${formatDegrees(lastSent.motor2)}` : "—"}
            </dd>
            <dt className="text-kumo-subtle">Updates sent</dt>
            <dd className="text-right tabular-nums">{sendCount}</dd>
            <dt className="text-kumo-subtle">Send rate</dt>
            <dd className="text-right tabular-nums">
              {rate}/s <span className="text-kumo-subtle">· limit {SEND_HZ}/s</span>
            </dd>
            <dt className="text-kumo-subtle">Backend</dt>
            <dd className="text-right">{backend.connected ? backend.name : "None — not sent"}</dd>
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
                      setManual((current) =>
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
