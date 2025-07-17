import { OAuthInitiateRequest } from './types';

/**
 * OAuth Initiation Service
 * Handles the first step of OAuth flow by redirecting users to external authentication
 */
export class OAuthInitiationService {
    private readonly baseAuthUrl: string;

    constructor(baseAuthUrl: string = 'https://marketplace.gohighlevel.com/oauth/chooselocation') {
        this.baseAuthUrl = baseAuthUrl;
    }

    /**
     * Initiates OAuth flow by creating redirect response
     * @param request OAuth initiation parameters
     * @returns Response object with redirect to external auth provider
     */
    async initiateOAuth(request: OAuthInitiateRequest): Promise<Response> {
        console.log('OAuth initiation started for client:', request.clientId);

        const redirectUrl = this.buildAuthUrl(request);
        
        console.log(`Redirecting to: ${redirectUrl}`);

        // Return redirect response (302)
        return Response.redirect(redirectUrl, 302);
    }

    /**
     * Builds the authentication URL with all required parameters
     * @param request OAuth initiation parameters
     * @returns Complete authentication URL
     */
    private buildAuthUrl(request: OAuthInitiateRequest): string {
        const params = new URLSearchParams({
            response_type: 'code',
            redirect_uri: request.redirectUri!,
            client_id: request.clientId,
            scope: request.scopes.join(' ')
        });

        return `${this.baseAuthUrl}?${params.toString()}`;
    }
}

/**
 * Factory function to create OAuth initiation service
 * @param baseAuthUrl Optional custom base auth URL
 * @returns OAuthInitiationService instance
 */
export function createOAuthInitiationService(baseAuthUrl?: string): OAuthInitiationService {
    return new OAuthInitiationService(baseAuthUrl);
}