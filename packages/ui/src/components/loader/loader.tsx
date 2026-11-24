import { resolveVariant } from "@repo/ui/lib/kumo/resolve-variant";

// Kumo, packages/kumo/src/components/loader/loader.tsx from https://github.com/cloudflare/kumo
// (release cloudflare/kumo@2.19.0), copied by the kumo-shadcn registry (https://github.com/tom-ricci/kumo-shadcn).
// Changes from Kumo's file: import paths.
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

/** Loader size variant definitions mapping sizes to their pixel values. */
export const KUMO_LOADER_VARIANTS = {
  size: {
    sm: {
      value: 16,
      description: "Small loader for inline use",
    },
    base: {
      value: 24,
      description: "Default loader size",
    },
    lg: {
      value: 32,
      description: "Large loader for prominent loading states",
    },
  },
} as const;

export const KUMO_LOADER_DEFAULT_VARIANTS = {
  size: "base",
} as const;

// Derived types from KUMO_LOADER_VARIANTS
export type KumoLoaderSize = keyof typeof KUMO_LOADER_VARIANTS.size;

export interface KumoLoaderVariantsProps {
  /**
   * Size of the loader. Use a preset name or a custom pixel number.
   * - `"sm"` — 16px, small loader for inline use
   * - `"base"` — 24px, default loader size
   * - `"lg"` — 32px, large loader for prominent loading states
   * @default "base"
   */
  size?: KumoLoaderSize | number;
}

export function loaderVariants({ size = KUMO_LOADER_DEFAULT_VARIANTS.size }: KumoLoaderVariantsProps = {}): number {
  if (typeof size === "number") return size;
  return resolveVariant(KUMO_LOADER_VARIANTS.size, size, KUMO_LOADER_DEFAULT_VARIANTS.size).value;
}

/**
 * Loader component props.
 *
 * @example
 * ```tsx
 * <Loader />
 * <Loader size="sm" />
 * <Loader size={24} />
 * ```
 */
export interface LoaderProps {
  /** Additional CSS classes merged via `cn()`. */
  className?: string;
  /**
   * Size of the spinner. Use a preset name or a custom pixel number.
   * - `"sm"` — 16px, for inline use
   * - `"base"` — 24px, default size
   * - `"lg"` — 32px, for prominent loading states
   * @default "base"
   */
  size?: KumoLoaderSize | number;
  /**
   * Accessible label for the loader, announced by screen readers.
   * Pass a translated string for internationalization.
   * @default "Loading"
   */
  "aria-label"?: string;
}

/**
 * Animated circular spinner for indicating loading states.
 *
 * @example
 * ```tsx
 * <Loader />
 * ```
 */
export const Loader = ({
  className,
  size = KUMO_LOADER_DEFAULT_VARIANTS.size,
  "aria-label": ariaLabel = "Loading",
}: LoaderProps) => {
  const sizeValue = loaderVariants({ size });
  return (
    <svg
      width={sizeValue}
      height={sizeValue}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      className={className}
      role="status"
      aria-label={ariaLabel}
    >
      <circle cx="12" cy="12" r="9.5" fill="none" strokeWidth="2" strokeLinecap="round">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 12 12"
          to="360 12 12"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-dasharray"
          values="0 150;42 150;42 150"
          keyTimes="0;0.5;1"
          dur="1.5s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-dashoffset"
          values="0;-16;-59"
          keyTimes="0;0.5;1"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="12" cy="12" r="9.5" fill="none" opacity={0.1} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};
