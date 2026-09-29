import repo from "@repo/oxfmt-config";

const config = structuredClone(repo.base);

config.sortTailwindcss = {
  stylesheet: "./src/styles/globals.css",
};
(config.ignorePatterns ??= []).push("dist/", "build/", "coverage/", "*.tsbuildinfo");

export default config;
