type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Browser-side, instance-scoped services. No pairing token is passed to App components. */
export type AppServices = {
  request: (
    path: string,
    options?: {
      method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      body?: Record<string, JsonValue>;
      signal?: AbortSignal;
    }
  ) => Promise<unknown>;
};

export type AppPageProps = {
  instanceId: string;
  services: AppServices;
};
