import repo from "@repo/oxfmt-config";

const config = structuredClone(repo.base);

(config.ignorePatterns ??= []).push("dist/", "build/", "coverage/", "*.tsbuildinfo");

export default config;
