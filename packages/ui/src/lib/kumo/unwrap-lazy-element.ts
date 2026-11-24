import React from "react";

// Kumo, packages/kumo/src/utils/unwrap-lazy-element.ts from https://github.com/cloudflare/kumo
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

const REACT_LAZY_TYPE = Symbol.for("react.lazy");

function isLazyReference(value: unknown): boolean {
  return typeof value === "object" && value !== null && (value as { $$typeof?: unknown }).$$typeof === REACT_LAZY_TYPE;
}

function isThenable(value: unknown): boolean {
  return typeof value === "object" && value !== null && typeof (value as { then?: unknown }).then === "function";
}

/**
 * Unwraps a lazy element reference produced by React Flight.
 *
 * When an element prop (e.g. `icon={<Star />}`) is passed from a Server
 * Component, the Flight client can deliver it as a lazy wrapper instead of an
 * element (https://github.com/react/react/issues/32392, closed as not
 * planned). The wrapper fails `React.isValidElement`, and rendering it as a
 * component throws React error #306 because it resolves to an element rather
 * than a component.
 *
 * `React.Children.toArray` resolves the wrapper to its element, the same
 * approach Base UI (`unwrapLazyRenderProp`) and Ark UI use. A pending wrapper
 * suspends.
 *
 * Anything that does not resolve to an element is returned unchanged, so the
 * caller renders it as a component as before. That includes a `React.lazy`
 * component: `toArray` returns nothing for one resolving to a function, and
 * throws for one resolving to a `forwardRef` or `memo` object (such as a
 * Phosphor icon). It also includes every lazy value on React 18, whose
 * `toArray` does not resolve lazy values; Server Components require React 19.
 * A genuine error resurfaces when React renders the returned wrapper.
 */
export function unwrapLazyElement<T>(value: T): T {
  if (!isLazyReference(value)) return value;
  let unwrapped: unknown;
  try {
    unwrapped = React.Children.toArray(value as React.ReactNode)[0];
  } catch (error) {
    if (isThenable(error)) throw error;
    return value;
  }
  return React.isValidElement(unwrapped) ? (unwrapped as T) : value;
}
