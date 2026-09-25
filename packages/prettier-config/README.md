# Prettier config

Shared `base` and `tailwind` presets for this workspace. Add
`@repo/prettier-config` with `workspace:*` and Prettier 3 to a package's development
dependencies, then create `prettier.config.mjs` (or `prettier.config.js` in an ESM
package):

```js
import repo from "@repo/prettier-config";

export default {
  ...repo.base,
  ...repo.tailwind,
  tailwindStylesheet: "./app/globals.css",
};
```

The Tailwind preset is optional. With Tailwind v4, set `tailwindStylesheet` to the
CSS entry point relative to the consuming config. The plugin is imported by this
package, so consumers do not need a separate plugin dependency under pnpm.

Add a `.prettierignore` in each consumer, even if empty. The root ignore file
excludes `apps/` and `packages/` because each workspace formats itself. Ignore
build output and other generated files in each package's own ignore file.

The exports live in `index.js`; `prettier.config.js` uses the base preset to format
this package itself. The ESLint config package also consumes this package. As in
the reference monorepo, this package does not depend on the ESLint config package,
which would create a dependency cycle in Turbo.

Run `pnpm --filter @repo/prettier-config format` or `typecheck` from the workspace
root. Run `pnpm format` to format the whole workspace.
