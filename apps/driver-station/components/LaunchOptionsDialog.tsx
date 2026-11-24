"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@repo/ui/components/button/button";
import { Dialog } from "@repo/ui/components/dialog/dialog";
import { InputArea } from "@repo/ui/components/input/input-area";
import { Switch } from "@repo/ui/components/switch/switch";
import { XIcon } from "@repo/ui/icons";
import {
  launchOptionsFor,
  launchOptionsToText,
  parseLaunchOptions,
  saveLaunchOptions,
  type LaunchOptionsText,
} from "@/lib/launch-options";

/** Edit the container options this browser sends when it starts an app. */
export function LaunchOptionsDialog({
  app,
  name,
  open,
  onOpenChange,
}: {
  /** The app's Cortex name; options are saved under it. */
  app: string;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {open && <LaunchOptionsForm app={app} name={name} onClose={() => onOpenChange(false)} />}
    </Dialog.Root>
  );
}

function LaunchOptionsForm({ app, name, onClose }: { app: string; name: string; onClose: () => void }) {
  const [text, setText] = useState<LaunchOptionsText>(() => launchOptionsToText(launchOptionsFor(app)));
  const [errors, setErrors] = useState<{ env?: string; volumes?: string }>({});
  const set = (change: Partial<LaunchOptionsText>) => {
    setText((current) => ({ ...current, ...change }));
    setErrors({});
  };

  function save(event: FormEvent) {
    event.preventDefault();
    const parsed = parseLaunchOptions(text);
    if ("errors" in parsed) return setErrors(parsed.errors);
    saveLaunchOptions(app, parsed.options);
    onClose();
  }

  return (
    <Dialog size="lg" className="flex flex-col gap-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <Dialog.Title className="text-(length:--kumo-font-size-lg)/[var(--tw-leading,var(--kumo-line-height-lg))] font-semibold">
            Launch options for {name}
          </Dialog.Title>
          <Dialog.Description className="text-kumo-subtle">
            Sent each time this browser starts {name}, on top of the defaults the app declares. Restarts and updates
            keep the options an instance was started with.
          </Dialog.Description>
        </div>
        <Dialog.Close
          render={
            <Button variant="ghost" shape="square" size="sm" aria-label="Close" className="-mt-1 -mr-2 shrink-0" />
          }
        >
          <XIcon size={16} />
        </Dialog.Close>
      </div>
      <form onSubmit={save} className="flex flex-col gap-4">
        <InputArea
          label="Environment variables"
          description="One per line, as NAME=value."
          placeholder="LOG_LEVEL=debug"
          rows={3}
          className="font-mono"
          spellCheck={false}
          autoCapitalize="none"
          value={text.env}
          onValueChange={(env) => set({ env })}
          error={errors.env}
        />
        <InputArea
          label="Volumes"
          description="One per line: a path on the robot, a colon, then the path inside the app."
          placeholder="/home/robot/maps:/maps"
          rows={2}
          className="font-mono"
          spellCheck={false}
          autoCapitalize="none"
          value={text.volumes}
          onValueChange={(volumes) => set({ volumes })}
          error={errors.volumes}
        />
        <InputArea
          label="Devices"
          description="One per line: a device on the robot to pass through."
          placeholder="/dev/ttyUSB0"
          rows={2}
          className="font-mono"
          spellCheck={false}
          autoCapitalize="none"
          value={text.devices}
          onValueChange={(devices) => set({ devices })}
        />
        <div className="flex flex-col gap-1">
          <Switch label="Privileged" checked={text.privileged} onCheckedChange={(privileged) => set({ privileged })} />
          <p className="text-(length:--kumo-font-size-sm)/[var(--tw-leading,var(--kumo-line-height-sm))] text-kumo-subtle">
            Gives the app full access to the robot’s devices and kernel. An app that declares itself privileged stays
            privileged either way.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Dialog.Close render={<Button type="button" />}>Cancel</Dialog.Close>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
