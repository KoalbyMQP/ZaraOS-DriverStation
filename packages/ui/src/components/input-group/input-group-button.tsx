import React, { forwardRef, useContext, type PropsWithChildren, type ReactNode } from "react";

// Kumo, packages/kumo/src/components/input-group/input-group-button.tsx from https://github.com/cloudflare/kumo
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
import { unwrapLazyElement } from "@repo/ui/lib/kumo/unwrap-lazy-element";
import { type ButtonProps, Button as ButtonExternal } from "@repo/ui/components/button/button";
import { Tooltip, type KumoTooltipSide } from "@repo/ui/components/tooltip/tooltip";
import type { KumoInputSize } from "@repo/ui/components/input/input";
import { INPUT_GROUP_SIZE, InputGroupAddonContext, useInputGroupContext } from "./context";

/**
 * In container mode, buttons render "one size down" so they stay visually
 * subordinate to the input.  In individual mode the size passes through
 * unchanged (pagination / toolbar buttons should match the input height).
 */
const COMPACT_BUTTON_SIZE: Record<KumoInputSize, KumoInputSize> = {
  xs: "xs",
  sm: "xs",
  base: "sm",
  lg: "base",
};

export type InputGroupButtonProps = ButtonProps & {
  /**
   * When provided, wraps the button in a `Tooltip` showing this content on hover.
   * Automatically sets `aria-label` from a string value when no `aria-label` is set.
   *
   * @example
   * ```tsx
   * <InputGroup.Addon align="end">
   *   <InputGroup.Button tooltip="Query language help" aria-label="Query language help">
   *     <QuestionIcon size={16} />
   *   </InputGroup.Button>
   * </InputGroup.Addon>
   * ```
   */
  tooltip?: ReactNode;
  /**
   * Preferred side for the tooltip popup.
   * @default "bottom"
   */
  tooltipSide?: KumoTooltipSide;
};

/**
 * Button for secondary actions rendered inside `InputGroup.Addon`
 * (toggle, copy, help).
 *
 * In `focusMode="container"` (default), renders as a compact ghost button
 * subordinate to the input. In `focusMode="individual"`, renders as a full
 * standalone button with its own focus ring, matching toolbar/pagination usage.
 *
 * Pass a `tooltip` prop to show a tooltip on hover.
 */
export const Button = forwardRef<HTMLButtonElement, PropsWithChildren<InputGroupButtonProps>>(
  (
    {
      children,
      className,
      variant,
      size,
      disabled,
      tooltip,
      tooltipSide = "bottom",
      icon: iconProp,
      ...props
    }: PropsWithChildren<InputGroupButtonProps>,
    ref: React.ForwardedRef<HTMLButtonElement>
  ) => {
    const context = useInputGroupContext("Button");
    const isInsideAddon = useContext(InputGroupAddonContext);
    const isDisabled = disabled ?? context?.disabled;
    const isIndividual = context?.focusMode === "individual" || context?.focusMode === "hybrid";
    const effectiveVariant = variant ?? "ghost";

    if (process.env.NODE_ENV !== "production" && context && effectiveVariant === "ghost" && !isInsideAddon) {
      console.warn("InputGroup.Button: Ghost buttons should be wrapped in <InputGroup.Addon> for correct spacing.");
    }

    if (process.env.NODE_ENV !== "production" && context && size !== undefined) {
      console.warn("InputGroup.Button: Set `size` on <InputGroup> instead of <InputGroup.Button>.");
    }

    // Derive aria-label from tooltip string when the button has no explicit label.
    // Icon-only buttons require an aria-label for a11y.
    const tooltipAriaLabel = typeof tooltip === "string" && !props["aria-label"] ? tooltip : undefined;

    // Pre-render the icon with the context-derived size so it matches the
    // Addon icon sizing (e.g. 18px at "base"). Without this, Button's
    // internal renderIconNode renders `<Icon />` with no size prop,
    // falling back to CSS font-size (~14px).
    const contextIconSize = context ? INPUT_GROUP_SIZE[context.size ?? "base"].iconSize : undefined;

    const icon = unwrapLazyElement(iconProp);
    const sizedIcon =
      icon &&
      contextIconSize &&
      (typeof icon === "function" || (typeof icon === "object" && icon !== null && !React.isValidElement(icon)))
        ? React.createElement(icon as React.ComponentType<{ size?: number }>, {
            size: contextIconSize,
          })
        : icon;

    const btn = (
      <ButtonExternal
        ref={ref}
        type="button"
        disabled={isDisabled}
        aria-label={tooltipAriaLabel}
        {...props}
        icon={sizedIcon}
        variant={variant ?? "ghost"}
        // Individual: use the group's size directly so buttons match the input height.
        // Container: render one size down so the button stays subordinate to the input.
        size={size ?? (isIndividual ? (context?.size ?? "sm") : (COMPACT_BUTTON_SIZE[context?.size ?? "base"] ?? "sm"))}
        className={cn(
          // Ensure clicks register even when parent has pointer-events-none (e.g. disabled overlay)
          "pointer-events-auto",
          // Suppress the base Button's drop shadow so InputGroup matches the flat
          // appearance of the standalone Input (ghost already sets shadow-none,
          // but secondary/primary/outline etc. inherit shadow-xs from Button base)
          "shadow-none",
          // Suppress the base Button's non-visible focus ring in all modes
          "focus:ring-0",
          // Container-zone buttons: use a subtle ring as focus indicator
          // The base Button also retains a forced-colors outline.
          !isIndividual && "focus-visible:ring-[1.5px] focus-visible:ring-kumo-focus/50",
          // Individual mode: each button owns its own border and focus indicator
          isIndividual && [
            // Own border replaces the container's shared ring; force full height
            "relative h-full! rounded-none border border-kumo-line ring-0 focus-visible:ring-0",
            "first:rounded-l-[inherit] last:rounded-r-[inherit]",
            // Negative margin (not border-l-0) so the border is still paintable on focus
            "not-first:-ml-px",
            "hover:z-1",
            // z-2 lifts above hovered siblings so focus border isn't clipped
            "focus:z-2",
            "focus-visible:border-kumo-focus/50",
            "disabled:bg-kumo-overlay disabled:text-kumo-inactive!",
          ],
          className
        )}
      >
        {children}
      </ButtonExternal>
    );

    if (tooltip) {
      return (
        <Tooltip content={tooltip} side={tooltipSide}>
          {btn}
        </Tooltip>
      );
    }

    return btn;
  }
);
Button.displayName = "InputGroup.Button";
