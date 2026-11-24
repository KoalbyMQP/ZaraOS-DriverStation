"use client";

// Kumo, packages/kumo/src/components/loader/skeleton-line.tsx from https://github.com/cloudflare/kumo
// (release cloudflare/kumo@2.19.0), copied by the kumo-shadcn registry (https://github.com/tom-ricci/kumo-shadcn).
// Changes from Kumo's file: import paths.
// Also changed: Kumo's helper classes, animations and data attributes carry a kumo- prefix.
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

import React, { useMemo } from "react";
import { cn } from "@repo/ui/lib/utils";
import { resolveVariant } from "@repo/ui/lib/kumo/resolve-variant";

/** SkeletonLine variant definitions mapping variant names to their root classes and descriptions. */
export const KUMO_SKELETON_LINE_VARIANTS = {
  variant: {
    default: {
      classes: "kumo-skeleton-line",
      description: "Flat grey bar with a sliding shimmer",
    },
    sketch: {
      classes: "relative h-2 w-(--skeleton-width)",
      description:
        "Wireframe-style bar: rounded fill with a sliding shimmer, a 1px outline, and construction strokes that overshoot each corner by 4px",
    },
  },
} as const;

export const KUMO_SKELETON_LINE_DEFAULT_VARIANTS = {
  variant: "default",
} as const;

export type KumoSkeletonLineVariant = keyof typeof KUMO_SKELETON_LINE_VARIANTS.variant;

/** Edge strokes drawn under the sketch variant's outline. */
const SKETCH_STROKE = "absolute bg-kumo-fill";

const getRandomWidth = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);

const getRandomFloat = (min: number, max: number) => (Math.random() * (max - min) + min).toFixed(2);

export const SkeletonLine = ({
  variant = KUMO_SKELETON_LINE_DEFAULT_VARIANTS.variant,
  minWidth = 30,
  maxWidth = 100,
  minDuration = 1.3,
  maxDuration = 1.7,
  minDelay = 0,
  maxDelay = 0.5,
  blockHeight,
  className,
}: {
  /**
   * Visual style of the line.
   * - `"default"` — flat grey bar with a sliding shimmer
   * - `"sketch"` — wireframe-style bar with an outline and construction
   *   strokes that overshoot each corner by 4px. Leave 4px of room around it
   *   so an `overflow: hidden` parent doesn't clip the strokes.
   * @default "default"
   */
  variant?: KumoSkeletonLineVariant;
  minWidth?: number;
  maxWidth?: number;
  minDuration?: number;
  maxDuration?: number;
  minDelay?: number;
  maxDelay?: number;
  blockHeight?: string | number;
  className?: string;
}) => {
  const { width, duration, delay } = useMemo(() => {
    return {
      width: getRandomWidth(minWidth, maxWidth),
      duration: getRandomFloat(minDuration, maxDuration),
      delay: getRandomFloat(minDelay, maxDelay),
    };
  }, [minWidth, maxWidth, minDuration, maxDuration, minDelay, maxDelay]);

  const lineStyle: React.CSSProperties & { [key: string]: string } = {
    "--skeleton-width": `${width}%`,
    "--shimmer-duration": `${duration}s`,
    "--shimmer-delay": `${delay}s`,
  };

  const rootClasses = resolveVariant(
    KUMO_SKELETON_LINE_VARIANTS.variant,
    variant,
    KUMO_SKELETON_LINE_DEFAULT_VARIANTS.variant
  ).classes;

  const line =
    variant === "sketch" ? (
      <div className={cn(rootClasses, className)} style={lineStyle} data-variant="sketch">
        {/* Fill with the same sliding highlight as the default variant. The
            8px radius clamps to a pill on short lines. */}
        <div className="absolute inset-0 overflow-hidden rounded-lg bg-kumo-recessed">
          <div className="absolute inset-0 animate-[kumo-shimmer_var(--shimmer-duration,1.5s)_var(--shimmer-delay,0s)_infinite_ease-in-out] bg-linear-to-r from-transparent via-kumo-contrast/8 to-transparent motion-reduce:animate-none" />
        </div>
        {/* Construction strokes along each edge, 4px past every corner. */}
        <div className={cn(SKETCH_STROKE, "-inset-x-1 top-0 h-px")} />
        <div className={cn(SKETCH_STROKE, "-inset-x-1 bottom-0 h-px")} />
        <div className={cn(SKETCH_STROKE, "-inset-y-1 left-0 w-px")} />
        <div className={cn(SKETCH_STROKE, "-inset-y-1 right-0 w-px")} />
        {/* Rounded outline, last so it sits above the strokes. */}
        <div className="absolute inset-0 rounded-lg border border-kumo-interact" />
      </div>
    ) : (
      <div className={cn(rootClasses, className)} style={lineStyle}></div>
    );

  if (blockHeight !== undefined) {
    const height = typeof blockHeight === "number" ? `${blockHeight}px` : blockHeight;
    return (
      <div className="flex items-center" style={{ height }}>
        {line}
      </div>
    );
  }

  return line;
};
