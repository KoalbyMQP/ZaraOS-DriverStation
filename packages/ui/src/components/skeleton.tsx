import { SkeletonLine } from "@repo/ui/components/loader/skeleton-line";

/**
 * A placeholder block sized by `className`. Kumo's SkeletonLine draws a random
 * width and shimmer timing on every render, which differs between the server
 * and the browser and fails hydration, so both are pinned here.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <SkeletonLine
      minWidth={100}
      maxWidth={100}
      minDuration={1.5}
      maxDuration={1.5}
      minDelay={0}
      maxDelay={0}
      className={className}
    />
  );
}
