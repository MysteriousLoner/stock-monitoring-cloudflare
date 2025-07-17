// Export all types and interfaces
export * from './types';
export * from './oauth-initiate';
export * from './oauth-callback';

// Import for internal use
import { createOAuthInitiateRequestBuilder, OAuthTokenData } from './types';
import { createOAuthInitiationService } from './oauth-initiate';
import { createOAuthCallbackService } from './oauth-callback';

// Re-export commonly used items for convenience
export type {
    OAuthInitiateRequest,
    OAuthTokenData,
    OAuthCallbackResult
} from './types';

export {
    createOAuthInitiateRequestBuilder
} from './types';

export {
    OAuthInitiationService,
    createOAuthInitiationService
} from './oauth-initiate';

export {
    OAuthCallbackService,
    createOAuthCallbackService
} from './oauth-callback';

/**
 * Complete OAuth Handler that encapsulates the entire OAuth flow
 */
export class OAuthHandler {
    private clientId: string;
    private clientSecret: string;
    private domain: string;
    private scopes: string[];

    constructor(clientId: string, clientSecret: string, domain: string, scopes: string[] = ['products.readonly', 'products/prices.readonly']) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.domain = domain;
        this.scopes = scopes;
    }

    /**
     * Handle OAuth initiation - creates redirect to external auth provider
     */
    async handleInitiation(): Promise<Response> {
        const oauthRequest = createOAuthInitiateRequestBuilder()
            .setDomain(this.domain)
            .setClientId(this.clientId)
            .setScopes(this.scopes)
            .build();

        const oauthService = createOAuthInitiationService();
        return oauthService.initiateOAuth(oauthRequest);
    }

    /**
     * Handle OAuth callback - processes callback and optionally stores credentials
     */
    async handleCallback(
        request: Request, 
        credentialStorage?: {
            insertCredential: (credential: {
                location_id: string;
                company_id: string;
                access_token: string;
                refresh_token: string;
                expires_at: string;
                receiverEmails: string[];
            }) => Promise<any>;
        }
    ): Promise<Response> {
        const callbackService = createOAuthCallbackService(
            this.clientId,
            this.clientSecret
        );

        const callbackResult = await callbackService.handleCallback(request);
        
        // If successful and credential storage is provided, store the credentials using the token data
        if (callbackResult.response.status === 200 && credentialStorage && callbackResult.tokenData) {
            try {
                await this.storeCredentialsFromTokenData(callbackResult.tokenData, credentialStorage);
            } catch (error) {
                console.error('Error storing credentials after OAuth callback:', error);
                // Don't fail the OAuth response even if storage fails
            }
        }

        return callbackResult.response;
    }

    /**
     * Store credentials using token data that has already been exchanged
     */
    private async storeCredentialsFromTokenData(
        tokenData: OAuthTokenData,
        credentialStorage: {
            insertCredential: (credential: {
                location_id: string;
                company_id: string;
                access_token: string;
                refresh_token: string;
                expires_at: string;
                receiverEmails: string[];
            }) => Promise<any>;
        }
    ): Promise<void> {
        // Store credentials using the already-exchanged token data
        const credentialResult = await credentialStorage.insertCredential({
            location_id: tokenData.locationId,
            company_id: tokenData.companyId || '',
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            receiverEmails: [] // Default empty array
        });
        console.log('Credential api status:', credentialResult.status);
        console.log('Credential store message:', credentialResult.message);
        if (credentialResult.status === "ERROR") {
            console.error('Failed to store credentials:', credentialResult.message);
            throw new Error(`Failed to store credentials: ${credentialResult.message}`);
        } else {
            console.log('Credentials stored successfully:', credentialResult.status);
        }
    }
}

/**
 * Factory function to create an OAuth handler
 */
export function createOAuthHandler(
    clientId: string, 
    clientSecret: string, 
    domain: string, 
    scopes?: string[]
): OAuthHandler {
    return new OAuthHandler(clientId, clientSecret, domain, scopes);
}
