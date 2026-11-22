"use client";

import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Badge } from "@repo/ui/components/badge/badge";
import { Banner } from "@repo/ui/components/banner/banner";
import { Button } from "@repo/ui/components/button/button";
import { InputGroup } from "@repo/ui/components/input-group/input-group";
import { Input } from "@repo/ui/components/input/input";
import { LayerCard } from "@repo/ui/components/layer-card/layer-card";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";
import {
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
  CheckIcon,
  EyeIcon,
  InfoIcon,
  LightningIcon,
  PlayIcon,
} from "@repo/ui/icons";
import { initialMovement, validateMovement, type Movement, type MovementDraft } from "./movement";

const ledColors = [
  { value: "green", label: "Green" },
  { value: "blue", label: "Blue" },
  { value: "red", label: "Red" },
] as const;

/** Kumo shows a field's error in place of its description; the alert role announces it. */
const fieldError = (message: string | false | undefined) =>
  message ? { message: <span role="alert">{message}</span>, match: true as const } : undefined;

function AnglePreview({ angle }: { angle: number | null }) {
  return (
    <figure className="flex flex-col items-center gap-3 rounded-lg bg-kumo-recessed px-4 py-5">
      <svg viewBox="0 0 220 180" className="h-44 w-full max-w-60" aria-hidden="true">
        <circle cx="110" cy="88" r="62" className="fill-kumo-base stroke-kumo-line" />
        <circle cx="110" cy="88" r="46" className="fill-none stroke-kumo-line" strokeDasharray="2 6" />
        <path d="M110 26V150M48 88H172" className="stroke-kumo-line" strokeDasharray="3 5" />
        <g className="fill-current font-mono text-[10px] text-kumo-subtle" textAnchor="middle">
          <text x="110" y="15">
            0°
          </text>
          <text x="194" y="92">
            90°
          </text>
          <text x="25" y="92">
            −90°
          </text>
          <text x="110" y="170">
            180°
          </text>
        </g>
        {angle !== null && (
          <g transform={`rotate(${angle % 360} 110 88)`} className="fill-none stroke-kumo-brand">
            <path d="M110 88V38" strokeWidth="4" strokeLinecap="round" />
            <path d="m104 44 6-8 6 8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
        <circle cx="110" cy="88" r="7" className="fill-kumo-brand stroke-kumo-base" strokeWidth="3" />
      </svg>
      <figcaption className="flex flex-col items-center gap-1">
        <span className="text-3xl font-medium tracking-tight tabular-nums">{angle === null ? "—" : `${angle}°`}</span>
        <span className="text-(length:--kumo-font-size-xs)/[var(--tw-leading,var(--kumo-line-height-xs))] text-kumo-subtle">
          Target angle · preview only
        </span>
      </figcaption>
    </figure>
  );
}

function Section({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <LayerCard>
      <LayerCard.Secondary className="flex-col items-start gap-0.5">
        <h2 className="text-kumo-default">{title}</h2>
        <p className="text-(length:--kumo-font-size-sm)/[var(--tw-leading,var(--kumo-line-height-sm))] font-normal text-pretty">
          {description}
        </p>
      </LayerCard.Secondary>
      <LayerCard.Primary className="gap-5 pr-4">
        {children}
        {footer}
      </LayerCard.Primary>
    </LayerCard>
  );
}

/** App-owned UI: no Next.js or Driver Station context dependencies, and no network requests. */
export default function MotorControlPage() {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<MovementDraft>(initialMovement);
  const [attempted, setAttempted] = useState(false);
  const [reviewed, setReviewed] = useState<Movement | null>(null);
  const errors = validateMovement(draft);
  const angle = errors.angleDegrees ? null : Number(draft.angleDegrees);
  const ledLabel = ledColors.find((color) => color.value === draft.ledColor)!.label;

  function update<K extends keyof MovementDraft>(key: K, value: MovementDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setReviewed(null);
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttempted(true);
    const invalid = Object.keys(errors)[0];
    if (invalid) {
      form.current?.querySelector<HTMLInputElement>(`[name="${invalid}"]`)?.focus();
      return;
    }
    setReviewed({
      joint: draft.joint.trim(),
      angleDegrees: Number(draft.angleDegrees),
      durationMs: Number(draft.durationMs),
      ledColor: draft.ledColor,
    });
  }

  function reset() {
    setDraft(initialMovement);
    setAttempted(false);
    setReviewed(null);
    form.current?.querySelector<HTMLInputElement>('[name="joint"]')?.focus();
  }

  // TODO: implement move, read-angle and torque calls after the app API is defined.
  // Keep all hardware actions disabled until then; review() only creates a local draft.
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8" aria-labelledby={`${id}-title`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 id={`${id}-title`} className="text-2xl font-semibold tracking-tight text-balance">
            Motor control
          </h1>
          <p className="text-pretty text-kumo-subtle">Prepare a single-joint movement and review its settings.</p>
        </div>
        <Badge variant="outline">UI preview</Badge>
      </header>

      <Banner
        role="note"
        icon={<InfoIcon weight="fill" aria-hidden="true" />}
        title="Local preview — motors will not move"
        description="Controls are ready to explore. Sending commands and reading motor feedback are not connected yet."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Section
          title="Movement settings"
          description="Choose a joint, target position, and travel time."
          footer={
            <div className="flex flex-wrap justify-between gap-3">
              <Button variant="ghost" size="lg" className="h-11" icon={ArrowCounterClockwiseIcon} onClick={reset}>
                Reset
              </Button>
              <Button type="submit" form={`${id}-form`} variant="primary" size="lg" className="h-11">
                Review movement
                <ArrowRightIcon aria-hidden="true" />
              </Button>
            </div>
          }
        >
          <form ref={form} id={`${id}-form`} noValidate onSubmit={review} className="flex flex-col gap-5">
            <Input
              label="Joint name"
              description="Use the joint name from your robot configuration."
              error={fieldError(attempted && errors.joint)}
              name="joint"
              size="lg"
              className="h-11"
              placeholder="e.g. Shoulder"
              autoComplete="off"
              spellCheck={false}
              value={draft.joint}
              onChange={(event) => update("joint", event.target.value)}
              aria-invalid={attempted && !!errors.joint}
            />

            <div className="grid items-start gap-5 sm:grid-cols-2">
              <InputGroup
                label={<span id={`${id}-angle-label`}>Target angle</span>}
                description="Absolute position in degrees."
                error={fieldError(attempted && errors.angleDegrees)}
                size="lg"
              >
                <InputGroup.Input
                  name="angleDegrees"
                  aria-labelledby={`${id}-angle-label`}
                  type="number"
                  step="any"
                  value={draft.angleDegrees}
                  onChange={(event) => update("angleDegrees", event.target.value)}
                  aria-invalid={attempted && !!errors.angleDegrees}
                />
                <InputGroup.Addon align="end">°</InputGroup.Addon>
              </InputGroup>
              <InputGroup
                label={<span id={`${id}-duration-label`}>Movement time</span>}
                description="Time to reach the target."
                error={fieldError(attempted && errors.durationMs)}
                size="lg"
              >
                <InputGroup.Input
                  name="durationMs"
                  aria-labelledby={`${id}-duration-label`}
                  type="number"
                  min="1"
                  step="1"
                  value={draft.durationMs}
                  onChange={(event) => update("durationMs", event.target.value)}
                  aria-invalid={attempted && !!errors.durationMs}
                />
                <InputGroup.Addon align="end">ms</InputGroup.Addon>
              </InputGroup>
            </div>

            <div className="grid gap-2">
              <span id={`${id}-led-label`} className="font-medium">
                Motor LED
              </span>
              <ToggleGroup
                aria-labelledby={`${id}-led-label`}
                value={[draft.ledColor]}
                onValueChange={(values) => {
                  const color = ledColors.find((candidate) => candidate.value === values[0]);
                  if (color) update("ledColor", color.value);
                }}
              >
                {ledColors.map((color) => (
                  <ToggleGroupItem key={color.value} value={color.value} className="h-10 px-3">
                    <CheckIcon aria-hidden="true" className="opacity-0 group-data-pressed/toggle:opacity-100" />
                    {color.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-(length:--kumo-font-size-sm)/[var(--tw-leading,var(--kumo-line-height-sm))] leading-snug text-kumo-subtle">
                LED color to use during the movement.
              </p>
            </div>
            <p className="text-(length:--kumo-font-size-xs)/[var(--tw-leading,var(--kumo-line-height-xs))] leading-relaxed text-kumo-subtle">
              Joint limits and supported movement times will be checked once the motor API is connected.
            </p>
          </form>
        </Section>

        <div className="flex min-w-0 flex-col gap-6">
          <Section
            title="Movement preview"
            description="Your draft target, not a live motor position."
            footer={
              <div className="flex flex-col items-stretch gap-2">
                <Button
                  variant="primary"
                  size="lg"
                  className="h-11 w-full justify-center"
                  icon={PlayIcon}
                  disabled
                  aria-describedby={`${id}-send-help`}
                >
                  Send to motor
                </Button>
                <p
                  id={`${id}-send-help`}
                  className="text-center text-(length:--kumo-font-size-xs)/[var(--tw-leading,var(--kumo-line-height-xs))] text-kumo-subtle"
                >
                  Available when the motor API is connected.
                </p>
              </div>
            }
          >
            <AnglePreview angle={angle} />
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3">
              <dt className="text-kumo-subtle">Joint</dt>
              <dd className="text-right wrap-anywhere">{draft.joint.trim() || "Not selected"}</dd>
              <dt className="text-kumo-subtle">Movement time</dt>
              <dd className="text-right tabular-nums">{errors.durationMs ? "—" : `${Number(draft.durationMs)} ms`}</dd>
              <dt className="text-kumo-subtle">Motor LED</dt>
              <dd className="text-right">{ledLabel}</dd>
            </dl>
            <p role="status" className="text-pretty text-kumo-subtle">
              {reviewed
                ? `Movement reviewed for ${reviewed.joint}. Nothing has been sent to the robot.`
                : "Review your settings to prepare a movement locally."}
            </p>
          </Section>

          <Section
            title="Motor feedback"
            description="Live readings and torque control are unavailable in this preview."
          >
            <dl className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <dt className="text-(length:--kumo-font-size-xs)/[var(--tw-leading,var(--kumo-line-height-xs))] text-kumo-subtle">
                  Current angle
                </dt>
                <dd className="font-medium">Unknown</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-(length:--kumo-font-size-xs)/[var(--tw-leading,var(--kumo-line-height-xs))] text-kumo-subtle">
                  Torque
                </dt>
                <dd className="font-medium">Unknown</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button size="lg" className="h-11" icon={EyeIcon} disabled>
                Read angle
              </Button>
              <Button size="lg" className="h-11" icon={LightningIcon} disabled>
                Enable torque
              </Button>
              <Button size="lg" className="h-11" disabled>
                Disable torque
              </Button>
            </div>
          </Section>
        </div>
      </div>
    </section>
  );
}
