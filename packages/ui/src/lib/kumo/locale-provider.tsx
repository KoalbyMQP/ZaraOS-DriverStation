import { createContext, useContext, useMemo, type ReactNode } from "react";

// Kumo, packages/kumo/src/utils/locale-provider.tsx from https://github.com/cloudflare/kumo
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

export interface KumoTranslations {
  breadcrumbs?: {
    /** Accessible name of the breadcrumb `nav` landmark. */
    label: string;
    /** Accessible name of the `Breadcrumbs.Clipboard` button. */
    copy: string;
    /** Tooltip on the `Breadcrumbs.Clipboard` button. */
    copyTooltip: string;
  };
  label?: {
    optional: string;
    tooltip: string;
  };
  layerDialog: {
    close: string;
    cancel: string;
  };
}

export type KumoTranslationsPartial = {
  [Key in keyof KumoTranslations]?: Partial<NonNullable<KumoTranslations[Key]>>;
};

type ResolvedKumoTranslations = {
  [Key in keyof KumoTranslations]-?: NonNullable<KumoTranslations[Key]>;
};

const defaultTranslations: ResolvedKumoTranslations = {
  breadcrumbs: {
    label: "breadcrumb",
    copy: "Copy",
    copyTooltip: "Click to copy",
  },
  label: {
    optional: "(optional)",
    tooltip: "More information",
  },
  layerDialog: {
    close: "Close",
    cancel: "Cancel",
  },
};

const KumoLocaleContext = createContext<ResolvedKumoTranslations>(defaultTranslations);

export interface KumoLocaleProviderProps {
  children: ReactNode;
  /**
   * Partial overrides for Kumo's built-in English copy. Components without an
   * override continue to use their English defaults.
   */
  translations?: KumoTranslationsPartial;
}

/**
 * Supplies translations for Kumo-owned UI copy. Explicit component props take
 * precedence over these defaults.
 */
export function KumoLocaleProvider({ children, translations }: KumoLocaleProviderProps) {
  const value = useMemo<ResolvedKumoTranslations>(
    () => ({
      breadcrumbs: {
        ...defaultTranslations.breadcrumbs,
        ...translations?.breadcrumbs,
      },
      label: {
        ...defaultTranslations.label,
        ...translations?.label,
      },
      layerDialog: {
        ...defaultTranslations.layerDialog,
        ...translations?.layerDialog,
      },
    }),
    [translations]
  );

  return <KumoLocaleContext.Provider value={value}>{children}</KumoLocaleContext.Provider>;
}

/** @internal Used by Kumo components to resolve translated built-in copy. */
export function useKumoLocale(): ResolvedKumoTranslations {
  return useContext(KumoLocaleContext);
}
