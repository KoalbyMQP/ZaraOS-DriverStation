import repo from "@repo/oxfmt-config";

const config = structuredClone(repo.base);

(config.ignorePatterns ??= []).push("apps/**", "packages/**", "*.tsbuildinfo", ".agents/skills/**");

export default config;
