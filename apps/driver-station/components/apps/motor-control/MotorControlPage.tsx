"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@repo/ui/components/input-group";
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

function AnglePreview({ angle }: { angle: number | null }) {
  return (
    <figure className="flex flex-col items-center gap-3 rounded-lg bg-muted/50 px-4 py-5">
      <svg viewBox="0 0 220 180" className="h-44 w-full max-w-60" aria-hidden="true">
        <circle cx="110" cy="88" r="62" className="fill-background stroke-border" />
        <circle cx="110" cy="88" r="46" className="fill-none stroke-border" strokeDasharray="2 6" />
        <path d="M110 26V150M48 88H172" className="stroke-border" strokeDasharray="3 5" />
        <g className="fill-muted-foreground font-mono text-[10px]" textAnchor="middle">
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
          <g transform={`rotate(${angle % 360} 110 88)`} className="text-primary">
            <path d="M110 88V38" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            <path
              d="m104 44 6-8 6 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )}
        <circle cx="110" cy="88" r="7" className="fill-primary stroke-background" strokeWidth="3" />
      </svg>
      <figcaption className="flex flex-col items-center gap-1">
        <span className="text-3xl font-medium tracking-tight tabular-nums">{angle === null ? "—" : `${angle}°`}</span>
        <span className="text-xs text-muted-foreground">Target angle · preview only</span>
      </figcaption>
    </figure>
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
          <p className="text-sm text-pretty text-muted-foreground">
            Prepare a single-joint movement and review its settings.
          </p>
        </div>
        <Badge variant="outline">UI preview</Badge>
      </header>

      <Alert role="note">
        <InfoIcon aria-hidden="true" />
        <AlertTitle>Local preview — motors will not move</AlertTitle>
        <AlertDescription>
          Controls are ready to explore. Sending commands and reading motor feedback are not connected yet.
        </AlertDescription>
      </Alert>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Movement settings</h2>
            </CardTitle>
            <CardDescription>Choose a joint, target position, and travel time.</CardDescription>
          </CardHeader>
          <CardContent>
            <form ref={form} id={`${id}-form`} noValidate onSubmit={review}>
              <FieldGroup>
                <Field data-invalid={attempted && !!errors.joint}>
                  <FieldLabel htmlFor={`${id}-joint`}>Joint name</FieldLabel>
                  <Input
                    id={`${id}-joint`}
                    name="joint"
                    className="h-11"
                    placeholder="e.g. Shoulder"
                    autoComplete="off"
                    spellCheck={false}
                    value={draft.joint}
                    onChange={(event) => update("joint", event.target.value)}
                    aria-invalid={attempted && !!errors.joint}
                    aria-describedby={`${id}-joint-help${attempted && errors.joint ? ` ${id}-joint-error` : ""}`}
                  />
                  <FieldDescription id={`${id}-joint-help`}>
                    Use the joint name from your robot configuration.
                  </FieldDescription>
                  {attempted && errors.joint && <FieldError id={`${id}-joint-error`}>{errors.joint}</FieldError>}
                </Field>

                <FieldGroup className="grid gap-5 sm:grid-cols-2">
                  <Field data-invalid={attempted && !!errors.angleDegrees}>
                    <FieldLabel htmlFor={`${id}-angle`}>Target angle</FieldLabel>
                    <InputGroup className="h-11">
                      <InputGroupInput
                        id={`${id}-angle`}
                        name="angleDegrees"
                        type="number"
                        step="any"
                        value={draft.angleDegrees}
                        onChange={(event) => update("angleDegrees", event.target.value)}
                        aria-invalid={attempted && !!errors.angleDegrees}
                        aria-describedby={`${id}-angle-help${attempted && errors.angleDegrees ? ` ${id}-angle-error` : ""}`}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>°</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldDescription id={`${id}-angle-help`}>Absolute position in degrees.</FieldDescription>
                    {attempted && errors.angleDegrees && (
                      <FieldError id={`${id}-angle-error`}>{errors.angleDegrees}</FieldError>
                    )}
                  </Field>
                  <Field data-invalid={attempted && !!errors.durationMs}>
                    <FieldLabel htmlFor={`${id}-duration`}>Movement time</FieldLabel>
                    <InputGroup className="h-11">
                      <InputGroupInput
                        id={`${id}-duration`}
                        name="durationMs"
                        type="number"
                        min="1"
                        step="1"
                        value={draft.durationMs}
                        onChange={(event) => update("durationMs", event.target.value)}
                        aria-invalid={attempted && !!errors.durationMs}
                        aria-describedby={`${id}-duration-help${attempted && errors.durationMs ? ` ${id}-duration-error` : ""}`}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>ms</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldDescription id={`${id}-duration-help`}>Time to reach the target.</FieldDescription>
                    {attempted && errors.durationMs && (
                      <FieldError id={`${id}-duration-error`}>{errors.durationMs}</FieldError>
                    )}
                  </Field>
                </FieldGroup>

                <Field>
                  <FieldLabel id={`${id}-led-label`}>Motor LED</FieldLabel>
                  <ToggleGroup
                    aria-labelledby={`${id}-led-label`}
                    variant="outline"
                    value={[draft.ledColor]}
                    onValueChange={(values) => {
                      const color = ledColors.find((candidate) => candidate.value === values[0]);
                      if (color) update("ledColor", color.value);
                    }}
                  >
                    {ledColors.map((color) => (
                      <ToggleGroupItem key={color.value} value={color.value} className="h-11 px-3">
                        <CheckIcon aria-hidden="true" className="opacity-0 group-aria-pressed/toggle:opacity-100" />
                        {color.label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <FieldDescription>LED color to use during the movement.</FieldDescription>
                </Field>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Joint limits and supported movement times will be checked once the motor API is connected.
                </p>
              </FieldGroup>
            </form>
          </CardContent>
          <CardFooter className="flex-wrap justify-between gap-3">
            <Button type="button" variant="ghost" className="h-11" onClick={reset}>
              <ArrowCounterClockwiseIcon data-icon="inline-start" aria-hidden="true" />
              Reset
            </Button>
            <Button type="submit" form={`${id}-form`} className="h-11">
              Review movement
              <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          </CardFooter>
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Movement preview</h2>
              </CardTitle>
              <CardDescription>Your draft target, not a live motor position.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <AnglePreview angle={angle} />
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Joint</dt>
                <dd className="text-right wrap-anywhere">{draft.joint.trim() || "Not selected"}</dd>
                <dt className="text-muted-foreground">Movement time</dt>
                <dd className="text-right tabular-nums">
                  {errors.durationMs ? "—" : `${Number(draft.durationMs)} ms`}
                </dd>
                <dt className="text-muted-foreground">Motor LED</dt>
                <dd className="text-right">{ledLabel}</dd>
              </dl>
              <p role="status" className="text-sm text-pretty text-muted-foreground">
                {reviewed
                  ? `Movement reviewed for ${reviewed.joint}. Nothing has been sent to the robot.`
                  : "Review your settings to prepare a movement locally."}
              </p>
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-2">
              <Button disabled className="h-11" aria-describedby={`${id}-send-help`}>
                <PlayIcon data-icon="inline-start" aria-hidden="true" />
                Send to motor
              </Button>
              <p id={`${id}-send-help`} className="text-center text-xs text-muted-foreground">
                Available when the motor API is connected.
              </p>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Motor feedback</h2>
              </CardTitle>
              <CardDescription>Live readings and torque control are unavailable in this preview.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">Current angle</dt>
                  <dd className="font-medium">Unknown</dd>
                </div>
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-muted-foreground">Torque</dt>
                  <dd className="font-medium">Unknown</dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled className="h-11">
                  <EyeIcon data-icon="inline-start" aria-hidden="true" />
                  Read angle
                </Button>
                <Button variant="outline" disabled className="h-11">
                  <LightningIcon data-icon="inline-start" aria-hidden="true" />
                  Enable torque
                </Button>
                <Button variant="outline" disabled className="h-11">
                  Disable torque
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
