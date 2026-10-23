import type { LocalContainerImage, RobotAppInstance } from "@/lib/robot-api";

export function installedApps(images: LocalContainerImage[], instances: RobotAppInstance[]) {
  const repositories = new Map<string, Set<string>>();
  for (const image of images) {
    if (!image.repository || image.repository === "<none>") continue;
    const tags = repositories.get(image.repository) ?? new Set<string>();
    image.tags.filter((tag) => tag && tag !== "<none>").forEach((tag) => tags.add(tag));
    repositories.set(image.repository, tags);
  }
  return [...repositories]
    .map(([repository, tags]) => {
      const app = repository.split("/").at(-1)!;
      const appInstances = instances
        .filter((instance) =>
          instance.image ? [...tags].some((tag) => instance.image === `${repository}:${tag}`) : instance.app === app
        )
        .sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""));
      const state =
        appInstances.find((i) => i.state === "running")?.state ??
        appInstances.find((i) => ["starting", "stopping"].includes(i.state))?.state ??
        appInstances[0]?.state ??
        "stopped";
      return {
        repository,
        app,
        name: app.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
        versions: [...tags].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })),
        instances: appInstances,
        state,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
