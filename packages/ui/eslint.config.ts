import repo from "@repo/eslint-config";
import { defineConfig } from "eslint/config";

export default defineConfig([
  ...repo.base,
  ...repo.react,
  ...repo.tsx,
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
  ...repo.css,
  // Kumo's own source, copied in by the shadcn CLI from the kumo-shadcn registry. It breaks a few of
  // our rules upstream (React Compiler checks, Kumo's CSS for browsers past baseline). Only those
  // rules are off, and only for these files, so the copies stay as Kumo wrote them.
  {
    files: [
      "src/components/{badge,banner,button,dialog,dropdown,empty,field,input,input-group,label,layer-card,link,loader,select,sidebar,text,tooltip}/**",
      "src/lib/kumo/**",
    ],
    rules: {
      "react-hooks/static-components": "off",
      "react-hooks/refs": "off",
      "react-hooks/rules-of-hooks": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-var": "off",
    },
  },
  {
    files: ["src/styles/kumo.css"],
    rules: {
      "css/use-baseline": "off",
      "css/no-important": "off",
      "css/no-invalid-properties": "off",
    },
  },
]);
