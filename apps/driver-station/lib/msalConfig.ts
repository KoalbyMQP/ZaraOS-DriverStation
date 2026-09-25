import { Configuration, INetworkModule, NetworkRequestOptions, NetworkResponse } from "@azure/msal-browser";

/**
 * Custom network client that proxies Azure AD token requests through our own
 * Next.js API route. This avoids AADSTS9002326 (cross-origin token redemption
 * rejected for "Web" platform URIs) and injects the client_secret server-side.
 */
const customNetworkClient: INetworkModule = {
    async sendGetRequestAsync<T>(url: string, options?: NetworkRequestOptions): Promise<NetworkResponse<T>> {
        const response = await fetch(url, {
            method: "GET",
            headers: options?.headers,
        });
        return {
            headers: Object.fromEntries(response.headers.entries()),
            body: await response.json() as T,
            status: response.status,
        };
    },

    async sendPostRequestAsync<T>(url: string, options?: NetworkRequestOptions): Promise<NetworkResponse<T>> {
        // Intercept token endpoint calls and proxy through our API route
        if (url.includes("/oauth2/v2.0/token")) {
            const response = await fetch("/api/azure-token-proxy", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: options?.body,
            });
            return {
                headers: Object.fromEntries(response.headers.entries()),
                body: await response.json() as T,
                status: response.status,
            };
        }

        // All other POST requests go directly
        const response = await fetch(url, {
            method: "POST",
            headers: options?.headers,
            body: options?.body,
        });
        return {
            headers: Object.fromEntries(response.headers.entries()),
            body: await response.json() as T,
            status: response.status,
        };
    },
};

export const msalConfig: Configuration = {
    auth: {
        clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID!,
        authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID}`,
        redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000",
    },
    system: {
        networkClient: customNetworkClient,
    },
};

export const loginRequest = {
    scopes: ["openid", "profile", "email"],
};
