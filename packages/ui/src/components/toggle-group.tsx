"use client";

import { Toggle } from "@cloudflare/kumo/primitives/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@cloudflare/kumo/primitives/toggle-group";
import { cn } from "cn";

type Size = "sm" | "base";

/**
 * A row of pressable options. Kumo has no toggle group, so this pairs its
 * primitives with the look of its segmented Tabs: a recessed track and a raised
 * pill for the pressed option. Items are buttons with `aria-pressed`.
 */
function ToggleGroup({ className, size = "base", ...props }: ToggleGroupPrimitive.Props & { size?: Size }) {
  return (
    <ToggleGroupPrimitive
      data-size={size}
      className={cn(
        "group/toggle-group flex w-fit items-stretch gap-0.5 rounded-lg bg-kumo-recessed p-0.5 ring ring-kumo-hairline/70 data-[size=sm]:rounded-md",
        className
      )}
      {...props}
    />
  );
}

function ToggleGroupItem({ className, ...props }: Toggle.Props) {
  return (
    <Toggle
      className={cn(
        "group/toggle flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-base font-medium whitespace-nowrap text-kumo-subtle select-none hover:text-kumo-default",
        "group-data-[size=sm]/toggle-group:h-5.5 group-data-[size=sm]/toggle-group:rounded group-data-[size=sm]/toggle-group:px-2 group-data-[size=sm]/toggle-group:text-xs",
        "focus:outline-hidden focus-visible:ring-2 focus-visible:ring-kumo-brand focus-visible:ring-inset",
        "data-pressed:bg-kumo-base data-pressed:text-kumo-default data-pressed:shadow-sm data-pressed:ring data-pressed:ring-kumo-line",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
