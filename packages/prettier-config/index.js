import * as tailwindPlugin from "prettier-plugin-tailwindcss";

export default {
  base: {
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
  },
  tailwind: {
    plugins: [tailwindPlugin],
  },
};
