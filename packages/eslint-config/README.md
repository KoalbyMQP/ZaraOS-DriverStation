# ESLint config

Shared flat-config presets for this workspace. Add `@repo/eslint-config` with
`workspace:*` and ESLint 9 to a package's development dependencies, then create
`eslint.config.mjs` (or `eslint.config.js` in an ESM package):

```js
import repo from "@repo/eslint-config";
import { defineConfig } from "eslint/config";

export default defineConfig([...repo.base, ...repo.json, ...repo.markdown]);
```

The exported presets are `base` (JavaScript, TypeScript, and Turbo), `next`, `tsx`,
`react`, `vite`, `json`, `markdown`, and `css` (including Tailwind v4 syntax).
`submodules` exposes the underlying plugins and configurations for customization.
For Next.js apps, include `repo.next` before `repo.base` to retain the shared
TypeScript rule overrides. Add `repo.css` when linting stylesheets.

The exports live in `index.js`. This package's `eslint.config.js` uses those
exports to lint itself, and `prettier.config.js` uses `@repo/prettier-config`.

Run `pnpm --filter @repo/eslint-config lint`, `format`, or `typecheck` from the
workspace root. The lint and format scripts apply fixes, matching the root
`pnpm lint` and `pnpm format` workflows.
