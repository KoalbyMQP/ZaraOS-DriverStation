import { z } from "zod";

const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .refine((value) => !["__proto__", "constructor", "prototype"].includes(value));
const exportsSchema = z
  .record(
    id,
    z.object({
      title: z.string().min(1).max(160),
      module: z
        .string()
        .regex(/^\.\/[a-zA-Z0-9_/-]+$/)
        .max(200),
    })
  )
  .refine((exports) => Object.keys(exports).length <= 100)
  .default({});

export const descriptorSchema = z.object({
  schemaVersion: z.literal(1),
  sdkVersion: z.literal(1),
  appId: id,
  appVersion: z.string().min(1).max(128),
  federation: z.object({
    name: z
      .string()
      .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
      .max(160),
    entry: z.string().min(1).max(2048),
    type: z.enum(["module", "var"]).default("module"),
  }),
  pages: exportsSchema,
  components: exportsSchema,
});

export type AppUiDescriptor = z.infer<typeof descriptorSchema>;

export function assetUrl(value: string, base: string): string {
  const url = new URL(value, base);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new Error("UI assets must use an HTTP or HTTPS URL without credentials or a fragment.");
  }
  return url.href;
}

export async function fetchDescriptor(url: string, signal: AbortSignal): Promise<AppUiDescriptor> {
  const response = await fetch(url, { signal, credentials: "omit" });
  if (!response.ok) throw new Error("UI description could not be loaded (" + response.status + ").");
  const result = descriptorSchema.safeParse(await response.json());
  if (!result.success) throw new Error("Unsupported or invalid UI description: " + result.error.issues[0].message);
  return {
    ...result.data,
    federation: { ...result.data.federation, entry: assetUrl(result.data.federation.entry, response.url || url) },
  };
}
