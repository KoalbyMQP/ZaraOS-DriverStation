// @ts-check

import repo from "@repo/prettier-config";

const config = {
  ...repo.base,
  ...repo.tailwind,
  tailwindStylesheet: "./app/globals.css",
};

export default config;
