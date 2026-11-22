import {
  createContext,
  forwardRef,
  type AnchorHTMLAttributes,
  type ForwardRefExoticComponent,
  type ReactNode,
  type RefAttributes,
  useContext,
} from "react";

// Kumo, packages/kumo/src/utils/link-provider.tsx from https://github.com/cloudflare/kumo
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

type LinkComponentProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  /**
   * @deprecated Use `href` instead. The `to` prop is a routing-framework concept
   * (e.g. React Router) that does not belong on a presentational component.
   *
   * If your application uses a client-side router, configure the `LinkProvider`
   * with a wrapper component that maps `href` to your router's navigation prop:
   *
   * ```tsx
   * const AppLink = forwardRef(({ href, ...rest }, ref) => (
   *   <ReactRouterLink ref={ref} to={href} {...rest} />
   * ));
   *
   * <LinkProvider component={AppLink}>
   *   <App />
   * </LinkProvider>
   * ```
   */
  to?: string;
};

const DefaultLinkComponent = forwardRef<HTMLAnchorElement, LinkComponentProps>(function DefaultAnchor(
  { to, href, ...rest },
  ref
) {
  // Children and other content props are passed via ...rest spread
  // oxlint-disable-next-line anchor-has-content
  return <a ref={ref} href={href ?? to ?? undefined} {...rest} />;
});

type ForwardLinkComponent = ForwardRefExoticComponent<LinkComponentProps & RefAttributes<HTMLAnchorElement>>;

const LinkComponentContext = createContext<ForwardLinkComponent>(DefaultLinkComponent);

export function useLinkComponent() {
  return useContext(LinkComponentContext);
}

/**
 * Provides a custom link component for all Kumo Link instances in the tree.
 *
 * Use this to integrate framework-specific routing (React Router, Next.js, etc.)
 * while keeping Kumo's Link component framework-agnostic.
 *
 * Your custom component receives standard anchor props (including `href`) and
 * is responsible for bridging to your router's API:
 *
 * @example React Router integration
 * ```tsx
 * import { Link as ReactRouterLink } from "react-router-dom";
 *
 * const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(
 *   ({ href, ...rest }, ref) => (
 *     <ReactRouterLink ref={ref} to={href ?? ""} {...rest} />
 *   ),
 * );
 *
 * <LinkProvider component={AppLink}>
 *   <App />
 * </LinkProvider>
 * ```
 *
 * @example Next.js integration
 * ```tsx
 * import NextLink from "next/link";
 *
 * const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(
 *   (props, ref) => <NextLink ref={ref} {...props} />,
 * );
 *
 * <LinkProvider component={AppLink}>
 *   <App />
 * </LinkProvider>
 * ```
 */
export function LinkProvider({ component, children }: { component?: ForwardLinkComponent; children: ReactNode }) {
  return (
    <LinkComponentContext.Provider value={component ?? DefaultLinkComponent}>{children}</LinkComponentContext.Provider>
  );
}

export type { LinkComponentProps };
