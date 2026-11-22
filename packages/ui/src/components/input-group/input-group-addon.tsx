import { Children, cloneElement, forwardRef, isValidElement, type ReactElement, type ReactNode } from "react";

// Kumo, packages/kumo/src/components/input-group/input-group-addon.tsx from https://github.com/cloudflare/kumo
// (release cloudflare/kumo@2.19.0), copied by the kumo-shadcn registry (https://github.com/tom-ricci/kumo-shadcn).
// Changes from Kumo's file: import paths.
// Also changed: cn comes from your shadcn utils (@/lib/utils).
// Unofficial; not affiliated with or endorsed by Cloudflare.
//
// MIT License Copyright (c) 2026 Cloudflare, Inc.
//
// Permission is hereby granted, free of
// charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice
// (including the next paragraph) shall be included in all copies or substantial
// portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
// ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
// EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR
// OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import { cn } from "@repo/ui/lib/utils";
import { useInputGroupContext, INPUT_GROUP_SIZE, InputGroupAddonContext } from "./context";
import { Button } from "./input-group-button";

export interface InputGroupAddonProps {
  /** Position relative to the input. @default "start" */
  align?: "start" | "end";
  /** Additional CSS classes. */
  className?: string;
  /** Addon content: icons, buttons, spinners, text. */
  children?: ReactNode;
}

/**
 * Container for icons, text, or compact buttons positioned at the start or end
 * of the input. Automatically sizes icon children to match the input size.
 */
export const Addon = forwardRef<HTMLDivElement, InputGroupAddonProps>(
  ({ align = "start", className, children }, ref) => {
    const context = useInputGroupContext("Addon");

    const size = context?.size ?? "base";
    const tokens = INPUT_GROUP_SIZE[size];

    // Inject size into direct icon children that don't already have one set.
    // Skips buttons (which have their own size handling) and non-element nodes.
    // Also tracks whether a Button is present so we can reduce outer padding.
    let containsButton = false;
    const sizedChildren = Children.map(children, (child) => {
      if (!isValidElement(child)) return child;
      if (child.type === Button) {
        containsButton = true;
        return child;
      }
      const props = child.props as { size?: unknown };
      if (props.size !== undefined) return child;
      return cloneElement(child as ReactElement<{ size?: number }>, {
        size: tokens.iconSize,
      });
    });

    // Always use flex-based positioning. CSS order controls visual placement.
    return (
      <div
        ref={ref}
        data-slot={align === "start" ? "input-group-addon-start" : "input-group-addon-end"}
        className={cn(
          "pointer-events-none relative z-[1] flex shrink-0 items-center gap-1.5",
          "text-kumo-subtle",
          tokens.fontSize,
          "*:pointer-events-auto",
          align === "start"
            ? cn("-order-1", containsButton ? tokens.addonButtonOuterStart : tokens.addonOuterStart, "pr-0")
            : cn("order-1", "pl-0", containsButton ? tokens.addonButtonOuterEnd : tokens.addonOuterEnd),
          className
        )}
      >
        <InputGroupAddonContext.Provider value={true}>{sizedChildren}</InputGroupAddonContext.Provider>
      </div>
    );
  }
);
Addon.displayName = "InputGroup.Addon";
