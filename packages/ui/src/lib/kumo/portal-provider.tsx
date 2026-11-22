import { createContext, useContext, type ReactNode, type RefObject } from "react";

// Kumo, packages/kumo/src/utils/portal-provider.tsx from https://github.com/cloudflare/kumo
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

/**
 * Portal container type - matches Base UI's FloatingPortal container prop.
 * Supports HTMLElement, ShadowRoot, or a ref to either.
 */
export type PortalContainer = HTMLElement | ShadowRoot | null | RefObject<HTMLElement | ShadowRoot | null>;

const PortalContainerContext = createContext<PortalContainer>(null);

/**
 * KumoPortalProvider — sets the default portal container for all Kumo overlay components.
 *
 * Use this to render Kumo overlays (Dialog, Tooltip, DropdownMenu, Select, Combobox,
 * Popover, CommandPalette, Toast) inside a Shadow DOM or custom container.
 *
 * When not provided, overlays portal to `document.body` (default browser behavior).
 * Individual components can override this via their own `container` prop.
 *
 * For app-wide portal stacking, consumers should set `isolation: isolate` on
 * their app root (not `<body>`). Do not add z-index workarounds to Kumo's
 * portaled components or target Base UI internal data attributes.
 *
 * @example Shadow DOM usage
 * ```tsx
 * function WebComponent() {
 *   const shadowRef = useRef<ShadowRoot>(null);
 *
 *   useEffect(() => {
 *     shadowRef.current = hostElement.attachShadow({ mode: 'open' });
 *   }, []);
 *
 *   return (
 *     <KumoPortalProvider container={shadowRef.current}>
 *       <App />
 *     </KumoPortalProvider>
 *   );
 * }
 * ```
 *
 * @example Custom container
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 *
 * <div ref={containerRef}>
 *   <KumoPortalProvider container={containerRef}>
 *     <Dialog.Root>...</Dialog.Root>
 *   </KumoPortalProvider>
 * </div>
 * ```
 */
export function KumoPortalProvider({
  container,
  children,
}: {
  /** The container element or ShadowRoot to portal overlays into. */
  container: PortalContainer;
  children: ReactNode;
}) {
  return <PortalContainerContext.Provider value={container}>{children}</PortalContainerContext.Provider>;
}

/**
 * Hook to get the portal container from context.
 * Returns null if no provider is present (defaults to document.body).
 *
 * @internal Used by overlay components to resolve their portal container.
 */
export function usePortalContainer(): PortalContainer {
  return useContext(PortalContainerContext);
}
