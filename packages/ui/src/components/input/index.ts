export { Input, inputVariants, type InputProps } from "./input";

// Kumo, packages/kumo/src/components/input/index.ts from https://github.com/cloudflare/kumo
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

export { InputArea, Textarea, type InputAreaProps } from "./input-area";

// Re-export InputGroup from its new dedicated directory so that the subpath
// `@cloudflare/kumo/components/input` continues to resolve InputGroup.
export {
  InputGroup,
  KUMO_INPUT_GROUP_VARIANTS,
  KUMO_INPUT_GROUP_DEFAULT_VARIANTS,
} from "@repo/ui/components/input-group/input-group";

// Backward-compatible type aliases — the old `input-group.tsx` exported these
// names. External consumers importing from `@cloudflare/kumo/components/input`
// may reference them, so we keep the aliases to avoid breaking type imports.

/**
 * @deprecated `focusMode` is no longer a public prop — it is auto-detected by
 * `InputGroup` based on its children. This type will be removed in a future
 * major version.
 */
export type KumoInputGroupFocusMode = "container" | "individual";

/**
 * @deprecated `focusMode` is no longer a public prop — it is auto-detected by
 * `InputGroup` based on its children. Use `InputGroupRootProps` from
 * `@cloudflare/kumo` instead. This type will be removed in a future major
 * version.
 */
export interface KumoInputGroupVariantsProps {
  focusMode?: KumoInputGroupFocusMode;
}
