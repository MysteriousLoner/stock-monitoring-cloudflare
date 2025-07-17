/**
 * Token Validation Service
 * Handles validation and refreshing of OAuth tokens
 */

export interface TokenValidationResult {
    valid: boolean;
    expiresAt?: string;
    message?: string;
}

export interface TokenRefreshResult {
    success: boolean;
    newAccessToken?: string;
    newRefreshToken?: string;
    expiresAt?: string;
    message?: string;
}

export class TokenValidator {
    private credentialsStub: any;
    private clientId: string;
    private clientSecret: string;

    constructor(credentialsStub: any, clientId: string, clientSecret: string) {
        this.credentialsStub = credentialsStub;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    /**
     * Validates if the token for a given location is still valid
     * @param locationId - The location ID to validate
     * @returns TokenValidationResult indicating if token is valid
     */
    async validateToken(locationId: string): Promise<TokenValidationResult> {
        if (!locationId) {
            return {
                valid: false,
                message: 'Location ID is required'
            };
        }

        // Get credentials from durable object - this is the only operation that can throw
        let credentialsResult;
        try {
            credentialsResult = await this.credentialsStub.getCredentials(locationId);
        } catch (error) {
            console.error('Error calling credentials durable object:', error);
            return {
                valid: false,
                message: `Failed to retrieve credentials: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
        
        if (credentialsResult.httpCode !== 200 || !credentialsResult.data) {
            return {
                valid: false,
                message: `No credentials found for location_id: ${locationId}`
            };
        }

        const { expires_at } = credentialsResult.data;

        if (!expires_at) {
            return {
                valid: false,
                message: 'No expiration date found in credentials'
            };
        }

        // Compare current time with expiration time - pure computation, cannot throw
        const currentTime = Date.now();
        const expirationTime = new Date(expires_at).getTime();
        const isValid = currentTime < expirationTime;

        return {
            valid: isValid,
            expiresAt: expires_at,
            message: isValid 
                ? 'Token is valid' 
                : `Token expired at ${expires_at}`
        };
    }

    /**
     * Refreshes the access token using the refresh token
     * @param locationId - The location ID to refresh token for
     * @returns TokenRefreshResult with new token information
     */
    async refreshToken(locationId: string): Promise<TokenRefreshResult> {
        if (!locationId) {
            return {
                success: false,
                message: 'Location ID is required'
            };
        }

        // Get current credentials - RPC call that can throw
        let credentialsResult;
        try {
            credentialsResult = await this.credentialsStub.getCredentials(locationId);
        } catch (error) {
            console.error('Error calling credentials durable object:', error);
            return {
                success: false,
                message: `Failed to retrieve credentials: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
        
        if (credentialsResult.httpCode !== 200 || !credentialsResult.data) {
            return {
                success: false,
                message: `No credentials found for location_id: ${locationId}`
            };
        }

        const { refresh_token } = credentialsResult.data;

        if (!refresh_token) {
            return {
                success: false,
                message: 'No refresh token found in credentials'
            };
        }

        // Make request to external OAuth provider - network call that can throw
        const tokenUrl = "https://services.leadconnectorhq.com/oauth/token";
        const params = new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: "refresh_token",
            refresh_token: refresh_token,
            user_type: "Location"
        });

        console.log(`Refreshing access token for location_id: ${locationId}`);
        
        let response;
        try {
            response = await fetch(tokenUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                },
                body: params.toString(),
            });
        } catch (error) {
            console.error('Network error during token refresh:', error);
            return {
                success: false,
                message: `Network error: ${error instanceof Error ? error.message : 'Unknown network error'}`
            };
        }

        if (!response.ok) {
            const errorText = await response.text();
            return {
                success: false,
                message: `Failed to refresh token: ${response.status} - ${errorText}`
            };
        }

        const tokenData = await response.json() as any;
        
        const newAccessToken = tokenData.access_token;
        const newRefreshToken = tokenData.refresh_token;
        const expiresIn = tokenData.expires_in;

        if (!newAccessToken || !newRefreshToken || !expiresIn) {
            return {
                success: false,
                message: 'Incomplete token response from OAuth provider'
            };
        }

        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        // Update credentials in durable object - RPC call that can throw
        let updateResult;
        try {
            updateResult = await this.credentialsStub.updateTokenPair(
                locationId,
                newAccessToken,
                newRefreshToken,
                expiresAt
            );
        } catch (error) {
            console.error('Error updating credentials in durable object:', error);
            return {
                success: false,
                message: `Failed to store updated credentials: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }

        if (!updateResult.success) {
            return {
                success: false,
                message: `Failed to update credentials: ${updateResult.message}`
            };
        }

        console.log(`Successfully refreshed tokens for location_id: ${locationId}`);

        return {
            success: true,
            newAccessToken,
            newRefreshToken,
            expiresAt,
            message: 'Token refreshed successfully'
        };
    }

    /**
     * Ensures a valid token exists for the location, refreshing if necessary
     * @param locationId - The location ID to ensure valid token for
     * @returns The valid access token or throws an error
     */
    async ensureValidToken(locationId: string): Promise<string> {
        // First validate the current token
        const validation = await this.validateToken(locationId);
        
        if (validation.valid) {
            // Token is valid, get the current access token - RPC call that can throw
            let credentialsResult;
            try {
                credentialsResult = await this.credentialsStub.getCredentials(locationId);
            } catch (error) {
                throw new Error(`Failed to retrieve valid token: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            return credentialsResult.data.access_token;
        }

        // Token is invalid/expired, refresh it
        console.log(`Token invalid for location_id: ${locationId}, refreshing...`);
        const refreshResult = await this.refreshToken(locationId);
        
        if (!refreshResult.success) {
            throw new Error(`Failed to refresh token: ${refreshResult.message}`);
        }

        return refreshResult.newAccessToken!;
    }
}

/**
 * Factory function to create a TokenValidator instance
 */
export function createTokenValidator(
    credentialsStub: any,
    clientId: string,
    clientSecret: string
): TokenValidator {
    return new TokenValidator(credentialsStub, clientId, clientSecret);
}
