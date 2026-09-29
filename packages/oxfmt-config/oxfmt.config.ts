import repo from "./index.ts";

const config = structuredClone(repo.base);

(config.ignorePatterns ??= []).push("dist/", "build/", "coverage/", "*.tsbuildinfo");

export default config;
