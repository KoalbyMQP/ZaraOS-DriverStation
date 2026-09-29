# Oxfmt config

Shared formatting rules for this workspace. Add `@repo/oxfmt-config` with
`workspace:*` and `oxfmt` at version `0.71.0` to a package's development
dependencies, then create `oxfmt.config.ts`:

```ts
import repo from "@repo/oxfmt-config";
import { defineConfig } from "oxfmt";

export default defineConfig({
  ...repo.base,
  ignorePatterns: ["dist/", "coverage/"],
});
```

The base preset preserves the existing formatting style, including a 120-column
print width and package.json field order. Override options in each package's
config as needed. Configs do not automatically merge with the root config.

For Tailwind v4, enable the built-in sorter in the app config:

```ts
export default defineConfig({
  ...repo.base,
  sortTailwindcss: {
    stylesheet: "./app/globals.css",
  },
});
```

The stylesheet path is relative to that config. No separate Prettier plugin is
needed.

## Commands and exclusions

Each package has a `format` script running `oxfmt --write .`. Run
`pnpm --filter @repo/driver-station format` for the app, or `pnpm format` for the
whole workspace through Turbo.

Put package-specific exclusions in that package's `ignorePatterns`. They apply
to files using that config, including files formatted through bundled Prettier.
The root `.prettierignore` is retained for global exclusions and must not exclude
`apps/` or `packages/`.

The root config excludes `apps/` and `packages/`. Its `format:root` command passes
`--disable-nested-config` so it only formats files owned by the root, while Turbo
runs each package's command separately. Direct `pnpm exec oxfmt --check .` from
the root checks the whole repo using each file's nearest config.

## VS Code

Open the repository as one folder and install the recommended Oxc extension.
Workspace settings select Oxfmt for the languages used here and enable format on
save. Keep `oxc.fmt.configPath` unset and `oxc.fmt.disableNestedConfig` false so
the editor finds each package's config. The extension's Oxlint integration is
disabled because this repo uses ESLint.

## Maintaining this package

The presets live in `index.ts`; `oxfmt.config.ts` uses them to format this package
itself. The package exposes its TypeScript source directly, so no build or separate
type declarations are needed. This package does not depend on
`@repo/eslint-config`, which would create a dependency cycle in Turbo.

Run `pnpm --filter @repo/oxfmt-config typecheck` to check the shared preset and its
config. Update Oxfmt versions together across the root and packages.
