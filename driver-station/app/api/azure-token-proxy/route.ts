import { NextRequest, NextResponse } from "next/server";

const TENANT_ID = process.env.AZURE_TENANT_ID || "";
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || "";

export async function POST(request: NextRequest) {
    try {
        const body = await request.text();
        const params = new URLSearchParams(body);

        // Inject client_secret for confidential client (Web platform) apps
        if (CLIENT_SECRET && !params.has("client_secret")) {
            params.set("client_secret", CLIENT_SECRET);
        }

        const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

        const response = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (err) {
        console.error("Azure token proxy error:", err);
        return NextResponse.json(
            { error: "token_proxy_error", error_description: String(err) },
            { status: 500 }
        );
    }
}
