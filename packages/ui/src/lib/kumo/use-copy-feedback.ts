import { useCallback, useEffect, useRef, useState } from "react";

// Kumo, packages/kumo/src/utils/use-copy-feedback.ts from https://github.com/cloudflare/kumo
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

type CopyOperation = (isCurrent: () => boolean) => unknown;
type CopyErrorHandler = (error: unknown) => void;

/**
 * Runs a copy operation and keeps its success feedback visible from the most
 * recent successful attempt. Older asynchronous attempts cannot overwrite it.
 */
export function useCopyFeedback(duration = 2000) {
  const [copied, setCopied] = useState(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    return () => {
      attemptRef.current += 1;
      if (resetTimeoutRef.current !== null) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const runCopy = useCallback(
    async (operation: CopyOperation, onError?: CopyErrorHandler) => {
      const attempt = ++attemptRef.current;
      if (resetTimeoutRef.current !== null) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }

      try {
        const isCurrent = () => attemptRef.current === attempt;
        await operation(isCurrent);
        if (attemptRef.current !== attempt) return false;

        setCopied(true);
        resetTimeoutRef.current = setTimeout(() => {
          if (attemptRef.current !== attempt) return;
          setCopied(false);
          resetTimeoutRef.current = null;
        }, duration);
        return true;
      } catch (error) {
        if (attemptRef.current !== attempt) return false;

        setCopied(false);
        onError?.(error);
        return false;
      }
    },
    [duration]
  );

  const reset = useCallback(() => {
    attemptRef.current += 1;
    if (resetTimeoutRef.current !== null) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
    setCopied(false);
  }, []);

  return { copied, runCopy, reset };
}
