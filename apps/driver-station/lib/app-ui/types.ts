export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** A command the App registered, as reported by `GET /instances/{id}/commands`. */
export type AppCommand = {
  name: string;
  doc: string | null;
  params: { name: string; required: boolean; type?: string; default?: JsonValue }[];
};

/** A continuously adjustable App value, as reported by `GET /instances/{id}/controls`. */
export type AppControl = {
  name: string;
  type: string | null;
  min: number | null;
  max: number | null;
  step: number | null;
  default: JsonValue;
  /** The value the App last applied, or `null` before its handler has run. */
  value: JsonValue;
  doc: string | null;
};

type RequestOptions = { signal?: AbortSignal };

/**
 * Browser-side, instance-scoped services. No pairing token is passed to App components.
 *
 * Every call goes to the selected instance through Cortex and is cancelled when the page unmounts,
 * the App stops, or the robot changes.
 */
export type AppServices = {
  /** Run a command. Resolves with the handler's return value; rejects with the App's error message. */
  command: (name: string, args?: Record<string, JsonValue>, options?: RequestOptions) => Promise<unknown>;
  /** List the commands the App accepts. */
  commands: (options?: RequestOptions) => Promise<AppCommand[]>;
  /** List the App's controls and the values it last applied. */
  controls: (options?: RequestOptions) => Promise<AppControl[]>;
  /**
   * Set a control. Resolves once the App has accepted the value, before its handler has run.
   * Updates are ordered by when they were sent, so one that arrives late cannot move the control
   * backwards; it resolves with `stale: true` and the value the App kept. `seq` overrides that
   * ordering and must be larger than every sequence the control has accepted, from any viewer.
   */
  setControl: (
    name: string,
    value: JsonValue,
    options?: RequestOptions & { seq?: number }
  ) => Promise<{ accepted: boolean; stale: boolean; value: JsonValue }>;
  /**
   * Subscribe to the App's live values. `onValues` first receives every key's latest value, then
   * only the keys that changed; a slow page skips intermediate values instead of falling behind.
   * The stream reconnects on its own. Returns a function that ends the subscription.
   */
  telemetry: (
    onValues: (values: Record<string, JsonValue>) => void,
    options?: RequestOptions & {
      /** Upper bound on updates per second, 0-1000. Omit or pass 0 for no limit. */
      maxHz?: number;
      /** Called when the stream cannot be opened. The subscription ends if the App has no telemetry. */
      onError?: (message: string) => void;
    }
  ) => () => void;
};

export type AppPageProps = {
  instanceId: string;
  services: AppServices;
};
