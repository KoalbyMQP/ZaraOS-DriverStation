import type { OxfmtConfig } from "oxfmt";

const base: OxfmtConfig = {
  ignorePatterns: ["pnpm-lock.yaml", ".turbo/"],
  printWidth: 120,
  sortPackageJson: false,
  singleQuote: false,
  semi: true,
  trailingComma: "es5",
  bracketSpacing: true,
  arrowParens: "always",
  overrides: [
    {
      files: ["**/*.json", "**/*.jsonc", "**/*.json5"],
      options: {
        trailingComma: "none",
      },
    },
  ],
};

export default { base };
