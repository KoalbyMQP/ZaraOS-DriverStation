import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import { defineConfig, globalIgnores } from "eslint/config";
import type { ESLint, Linter } from "eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import turbo from "eslint-plugin-turbo";
import { tailwind4 } from "tailwind-csstree";

// The JSON plugin uses language-specific rule types that ESLint's generic plugin type cannot represent.
const jsonPlugins = { json: json as unknown as ESLint.Plugin };

export default {
  submodules: {
    nextVitals,
    nextTs,
    js,
    globals,
    tseslint,
    json,
    markdown,
    css,
    jsxA11y,
    reactHooks,
    reactRefresh,
    turbo,
    tailwind4,
  },
  base: defineConfig([
    // Turbo types its configs as optional and includes legacy configs in the union.
    turbo.configs!["flat/recommended"] as Linter.Config,
    globalIgnores(["**/.turbo/**"]),
    {
      files: ["**/*.{js,mjs,cjs,jsx,mjsx,cjsx}"],
      plugins: { js },
      extends: [js.configs.recommended],
      languageOptions: {
        ecmaVersion: 2020,
        globals: {
          ...globals.browser,
          ...globals.node,
        },
      },
    },
    {
      files: ["**/*.{ts,mts,cts,tsx,mtsx,ctsx}"],
      extends: tseslint.configs.recommended,
      rules: {
        "@typescript-eslint/no-unused-vars": "warn",
        "@typescript-eslint/ban-ts-comment": "warn",
        "@typescript-eslint/no-explicit-any": "warn",
      },
    },
  ]),
  next: defineConfig([...nextVitals, ...nextTs, globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"])]),
  tsx: defineConfig([
    {
      files: ["**/*.{js,mjs,cjs,jsx,mjsx,cjsx,ts,mts,cts,tsx,mtsx,ctsx}"],
      plugins: {
        "jsx-a11y": jsxA11y,
      },
    },
  ]),
  react: defineConfig([
    {
      files: ["**/*.{js,mjs,cjs,jsx,mjsx,cjsx,ts,mts,cts,tsx,mtsx,ctsx}"],
      extends: [reactHooks.configs.flat.recommended],
      rules: {
        "react-hooks/set-state-in-effect": "warn",
      },
    },
  ]),
  vite: defineConfig([
    {
      files: ["**/*.{js,mjs,cjs,jsx,mjsx,cjsx,ts,mts,cts,tsx,mtsx,ctsx}"],
      extends: [reactRefresh.configs.vite],
    },
  ]),
  json: defineConfig([
    {
      files: ["**/*.json"],
      plugins: jsonPlugins,
      language: "json/json",
      extends: ["json/recommended"],
    },
    {
      files: ["**/tsconfig.json"],
      plugins: jsonPlugins,
      language: "json/jsonc",
      extends: ["json/recommended"],
    },
    {
      files: ["**/*.jsonc"],
      plugins: jsonPlugins,
      language: "json/jsonc",
      extends: ["json/recommended"],
    },
    {
      files: ["**/*.json5"],
      plugins: jsonPlugins,
      language: "json/json5",
      extends: ["json/recommended"],
    },
  ]),
  markdown: defineConfig([
    {
      files: ["**/*.md"],
      plugins: { markdown },
      language: "markdown/gfm",
      extends: ["markdown/recommended"],
    },
  ]),
  css: defineConfig([
    {
      files: ["**/*.css"],
      plugins: { css },
      language: "css/css",
      languageOptions: {
        customSyntax: tailwind4,
        tolerant: true,
      },
      extends: ["css/recommended"],
    },
  ]),
};
