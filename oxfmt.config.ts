import repo from "@repo/oxfmt-config";

const config = structuredClone(repo.base);

(config.ignorePatterns ??= []).push("apps/**", "packages/**", "*.tsbuildinfo");

export default config;
