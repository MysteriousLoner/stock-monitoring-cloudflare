import { DurableObject } from "cloudflare:workers";
import { CredentialsDurableObject } from "../durable-objects/credentials-durable-object";

export class EndpointsDurableObject extends DurableObject<Env> {

    constructor(ctx: DurableObjectState, env: Env) {
            super(ctx, env);
        }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        console.log('[DO] Path inside DO.fetch():', url.pathname);

        // if (url.pathname === '/oauth/initiate') {
        //     console.log('[DO] oauth_init triggered');
        //     return this.oauth_init();
        // }

        // return new Response('Not Found', { status: 404 });
        
        switch (url.pathname) {
            case '/oauth/initiate':
            console.log('[DO] oauth_init triggered');
            return this.oauth_init();

            case '/oauth/callback':
            console.log('[DO] oauth_callback triggered');
            return this.oauth_callback(request);

            default:
            return new Response('Not Found', { status: 404 });
        }
    }

    async oauth_init(): Promise<Response> {
        console.log("OAuth initiation started");
        // You don't need to check the path here; it's handled by the Worker
        const domain = this.env.DOMAIN;
        const clientId = this.env.GHL_CLIENT_ID;

        const baseUrl = 'https://marketplace.gohighlevel.com/oauth/chooselocation?';
        const redirectUri = `${domain}/oauth/callback`;
        const scopes = ['products.readonly', 'products/prices.readonly'];

        const redirectUrl =
        `${baseUrl}` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `client_id=${clientId}&` +
        `scope=${encodeURIComponent(scopes.join(' '))}`;

        console.log(`Redirecting to: ${redirectUrl}`);

        return Response.redirect(redirectUrl, 302);
        // return redirectUri;
    }

    async oauth_callback(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const authCode = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        console.log(`Received callback with code: ${authCode?.slice(0, 10) ?? 'None'}...`);
        console.log(`Received state: ${state}`);

        if (!authCode) {
        return new Response(
            JSON.stringify({
            success: false,
            message: "Authorization code not provided",
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
        }

        const tokenUrl = "https://services.leadconnectorhq.com/oauth/token";

        const params = new URLSearchParams();
        params.append('client_id', this.env.GHL_CLIENT_ID);
        params.append('client_secret', this.env.GHL_CLIENT_SECRET);
        params.append('grant_type', 'authorization_code');
        params.append('code', authCode);
        params.append('user_type', 'Location');

        try {
        console.log(`Making token request to: ${tokenUrl}`);
        console.log(`Request data: ${params.toString()}`);

        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        console.log(`Response status: ${tokenResponse.status}`);

        if (!tokenResponse.ok) {
            const errorBody = await tokenResponse.text();
            console.error(`Error response body: ${errorBody}`);

            return new Response(
            JSON.stringify({
                success: false,
                message: "Failed to exchange authorization code",
                error: errorBody,
            }),
            { status: tokenResponse.status, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const tokenData = await tokenResponse.json();

        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token;
        const expiresIn = tokenData.expires_in;
        const locationId = tokenData.locationId;

        console.log(`Access Token: ${accessToken?.slice(0, 10) ?? 'None'}...`);
        console.log(`Refresh Token: ${refreshToken?.slice(0, 10) ?? 'None'}...`);
        console.log(`Expires In: ${expiresIn}`);
        console.log(`Location ID: ${locationId}`);

        // Validate the tokens

        if (!accessToken || !refreshToken || !expiresIn || !locationId) {
            return new Response(
            JSON.stringify({
                success: false,
                message: "Incomplete token response from OAuth provider",
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        console.log("returning credentials");
        return new Response(
            JSON.stringify({
            success: true,
            message: "Authentication successful",
            data: {
                location_id: locationId,
                company_id: tokenData.companyId,
                user_type: tokenData.userType,
                scope: tokenData.scope,
                expires_in: expiresIn,
                refresh_token: refreshToken,
                access_token: accessToken,
            },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

        } catch (e) {
        console.error(`Unexpected error: ${e}`);

        return new Response(
            JSON.stringify({
            success: false,
            message: `Unexpected error: ${e}`,
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
        }
    }
}