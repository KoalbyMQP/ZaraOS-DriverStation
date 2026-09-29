# ESLint config

Shared flat-config presets for this workspace. Add `@repo/eslint-config` with
`workspace:*` and ESLint 9 to a package's development dependencies, then create
`eslint.config.ts`:

```ts
import repo from "@repo/eslint-config";
import { defineConfig } from "eslint/config";

export default defineConfig([
  ...repo.base,
  {
    files: ["**/*.{js,mjs,cjs,jsx,mjsx,cjsx,ts,mts,cts,tsx,mtsx,ctsx}"],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  ...repo.json,
  ...repo.markdown,
]);
```

Set `tsconfigRootDir` in each consuming config to its own directory. The editor
can load several workspace configs in one ESLint process, so the parser cannot
reliably infer a single root. Scope these parser options to JavaScript and
TypeScript files so they do not affect JSON, Markdown, or CSS parsers.

The exported presets are `base` (JavaScript, TypeScript, and Turbo), `next`, `tsx`,
`react`, `vite`, `json`, `markdown`, and `css` (including Tailwind v4 syntax).
`submodules` exposes the underlying plugins and configurations for customization.
For Next.js apps, include `repo.next` before `repo.base` to retain the shared
TypeScript rule overrides. Add `repo.css` when linting stylesheets.

The exports live in `index.ts`. This package's `eslint.config.ts` uses those
exports to lint itself, and `oxfmt.config.ts` uses `@repo/oxfmt-config`.

The package exposes TypeScript source directly, with no build step or separate
type declarations. ESLint loads the configs through `jiti`, which is already a
dependency of this package.

We use `.ts` for ESLint and Oxfmt configs. Both tools support it; `.mts` is only
needed when a file must explicitly be treated as an ES module regardless of its
package settings.

Run `pnpm --filter @repo/eslint-config lint`, `format`, or `typecheck` from the
workspace root. The lint and format scripts apply fixes, matching the root
`pnpm lint` and `pnpm format` workflows.
