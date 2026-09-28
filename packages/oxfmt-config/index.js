/** @type {import("oxfmt").OxfmtConfig} */
const base = {
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
