import type { ComponentProps } from "react";
import { cn } from "cn";

/** Keyboard shortcut hint. Kumo has no equivalent, so this follows its tokens. */
export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-kumo-recessed px-1 font-sans text-xs font-medium text-kumo-subtle select-none",
        className
      )}
      {...props}
    />
  );
}
