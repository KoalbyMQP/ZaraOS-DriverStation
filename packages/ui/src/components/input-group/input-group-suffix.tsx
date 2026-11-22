import { forwardRef, type ReactNode } from "react";

// Kumo, packages/kumo/src/components/input-group/input-group-suffix.tsx from https://github.com/cloudflare/kumo
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
import { useInputGroupContext, INPUT_GROUP_SIZE } from "./context";

export interface InputGroupSuffixProps {
  /** Additional CSS classes. */
  className?: string;
  /** Suffix content (e.g., ".workers.dev"). */
  children?: ReactNode;
}

/**
 * Inline suffix that flows seamlessly next to the typed input value.
 * Input width adjusts automatically via CSS `field-sizing: content`.
 */
export const Suffix = forwardRef<HTMLDivElement, InputGroupSuffixProps>(({ className, children }, ref) => {
  const context = useInputGroupContext("Suffix");

  const size = context?.size ?? "base";
  const tokens = INPUT_GROUP_SIZE[size];

  return (
    <div
      ref={ref}
      data-slot="input-group-suffix"
      className={cn(
        "pointer-events-none flex min-w-0 grow items-center text-kumo-subtle select-none",
        tokens.fontSize,
        tokens.suffixPad,
        className
      )}
    >
      <span className="truncate">{children}</span>
    </div>
  );
});
Suffix.displayName = "InputGroup.Suffix";
