"use client";

import type { ComponentProps } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { cn } from "cn";

const cell =
  "flex h-full shrink-0 items-center border-b border-kumo-line px-3 text-(length:--kumo-font-size-sm)/[var(--tw-leading,var(--kumo-line-height-sm))] leading-5 whitespace-nowrap text-kumo-default focus:outline-hidden focus-visible:ring-2 focus-visible:ring-kumo-brand focus-visible:ring-inset";

/**
 * Editor-style tab strip for terminal sessions: square cells on the shell
 * background, with a green line above the active one. Kumo's Tabs is a rounded
 * segmented or underline control without panels, so this uses its primitives.
 */
function TerminalTabs({ className, ...props }: Tabs.Root.Props) {
  return <Tabs.Root className={cn("flex h-full min-h-80 flex-col", className)} {...props} />;
}

/** The strip itself. Holds the list and any actions that follow it. */
function TerminalTabsBar({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex h-[41px] shrink-0 overflow-x-auto bg-kumo-canvas", className)} {...props} />;
}

function TerminalTabsList({ className, ...props }: Tabs.List.Props) {
  return <Tabs.List className={cn("flex h-full shrink-0", className)} {...props} />;
}

function TerminalTab({ className, ...props }: Tabs.Tab.Props) {
  return (
    <Tabs.Tab
      className={cn(
        cell,
        "relative cursor-pointer border-r font-mono hover:bg-(--kumo-highlight)",
        "after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-kumo-success after:opacity-0",
        "data-active:border-b-transparent data-active:bg-kumo-canvas data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  );
}

/** A button that fills the rest of the strip, such as "New session". */
function TerminalTabsAction({ className, type = "button", ...props }: ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={cn(
        cell,
        "flex-1 gap-1 hover:bg-(--kumo-highlight) disabled:cursor-not-allowed disabled:text-kumo-subtle disabled:hover:bg-transparent [&_svg]:size-3",
        className
      )}
      {...props}
    />
  );
}

function TerminalTabPanel({ className, ...props }: Tabs.Panel.Props) {
  return (
    <Tabs.Panel
      className={cn("min-h-0 flex-1 overflow-hidden outline-none data-hidden:hidden [[inert]]:hidden", className)}
      {...props}
    />
  );
}

export { TerminalTabs, TerminalTabsBar, TerminalTabsList, TerminalTab, TerminalTabsAction, TerminalTabPanel };
