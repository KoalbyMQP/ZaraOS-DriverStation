const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeHostname(hostname: string): string {
    // Remove port when host header is passed as "hostname:port".
    return hostname.split(":")[0].trim().toLowerCase();
}

export function isLoopbackHost(hostname?: string | null): boolean {
    if (!hostname) return false;
    return LOOPBACK_HOSTS.has(normalizeHostname(hostname));
}

export function isClientLocalAuthBypassEnabled(): boolean {
    return (
        process.env.NODE_ENV === "development" &&
        process.env.NEXT_PUBLIC_AUTH_BYPASS_LOCAL === "true"
    );
}

export function isServerLocalAuthBypassEnabled(hostname?: string | null): boolean {
    if (process.env.NODE_ENV !== "development") return false;
    if (process.env.AUTH_BYPASS_LOCAL !== "true") return false;
    if (hostname == null) return true;
    return isLoopbackHost(hostname);
}
