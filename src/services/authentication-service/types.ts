// OAuth initiation request parameters
export interface OAuthInitiateRequest {
    domain: string;
    clientId: string;
    scopes: string[];
    redirectUri?: string; // Optional, will be constructed if not provided
}

// OAuth callback response data
export interface OAuthTokenData {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    locationId: string;
    companyId?: string;
    userType?: string;
    scope?: string;
}

// OAuth callback result
export interface OAuthCallbackResult {
    success: boolean;
    message: string;
    data?: OAuthTokenData;
    error?: string;
}

// Builder for OAuth initiate request
export class OAuthInitiateRequestBuilder {
    private request: Partial<OAuthInitiateRequest> = {};

    setDomain(domain: string): OAuthInitiateRequestBuilder {
        this.request.domain = domain;
        return this;
    }

    setClientId(clientId: string): OAuthInitiateRequestBuilder {
        this.request.clientId = clientId;
        return this;
    }

    setScopes(scopes: string[]): OAuthInitiateRequestBuilder {
        this.request.scopes = scopes;
        return this;
    }

    addScope(scope: string): OAuthInitiateRequestBuilder {
        if (!this.request.scopes) {
            this.request.scopes = [];
        }
        this.request.scopes.push(scope);
        return this;
    }

    setRedirectUri(redirectUri: string): OAuthInitiateRequestBuilder {
        this.request.redirectUri = redirectUri;
        return this;
    }

    build(): OAuthInitiateRequest {
        if (!this.request.domain) {
            throw new Error('Domain is required');
        }
        if (!this.request.clientId) {
            throw new Error('Client ID is required');
        }
        if (!this.request.scopes || this.request.scopes.length === 0) {
            throw new Error('At least one scope is required');
        }

        // Set default redirect URI if not provided
        if (!this.request.redirectUri) {
            this.request.redirectUri = `${this.request.domain}/oauth/callback`;
        }

        return this.request as OAuthInitiateRequest;
    }
}

// Utility function to create builder
export function createOAuthInitiateRequestBuilder(): OAuthInitiateRequestBuilder {
    return new OAuthInitiateRequestBuilder();
}
