import { OAuthCallbackResult, OAuthTokenData } from './types';

/**
 * OAuth Callback Service
 * Handles the callback from external OAuth provider and exchanges code for tokens
 */
export class OAuthCallbackService {
    private readonly tokenUrl: string;
    private readonly clientId: string;
    private readonly clientSecret: string;

    constructor(clientId: string, clientSecret: string, tokenUrl: string = 'https://services.leadconnectorhq.com/oauth/token') {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.tokenUrl = tokenUrl;
    }

    /**
     * Handles OAuth callback and exchanges authorization code for tokens
     * @param request The incoming request from OAuth provider
     * @returns Object containing HTML response and token data if successful
     */
    async handleCallback(request: Request): Promise<{ response: Response; tokenData?: OAuthTokenData }> {
        const url = new URL(request.url);
        const authCode = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        console.log(`OAuth callback received - Code: ${authCode?.slice(0, 10) ?? 'None'}..., State: ${state}`);

        if (!authCode) {
            const result: OAuthCallbackResult = {
                success: false,
                message: 'Authorization code not provided',
                error: 'MISSING_AUTH_CODE'
            };
            return { response: this.buildHtmlResponse(result) };
        }

        try {
            const tokenData = await this.exchangeCodeForTokens(authCode);
            
            const result: OAuthCallbackResult = {
                success: true,
                message: 'Authentication successful',
                data: tokenData
            };

            console.log(`OAuth callback successful - Location: ${tokenData.locationId}`);
            
            return { 
                response: this.buildHtmlResponse(result),
                tokenData: tokenData
            };

        } catch (error) {
            console.error('OAuth callback error:', error);
            
            const result: OAuthCallbackResult = {
                success: false,
                message: 'Failed to exchange authorization code',
                error: error instanceof Error ? error.message : 'Unknown error'
            };

            return { response: this.buildHtmlResponse(result) };
        }
    }

    /**
     * Exchanges authorization code for access and refresh tokens
     * @param authCode Authorization code from OAuth provider
     * @returns Token data from OAuth provider
     */
    private async exchangeCodeForTokens(authCode: string): Promise<OAuthTokenData> {
        const params = new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'authorization_code',
            code: authCode,
            user_type: 'Location'
        });

        console.log(`Making token request to: ${this.tokenUrl}`);

        const response = await fetch(this.tokenUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Token exchange failed: ${response.status} - ${errorBody}`);
            throw new Error(`Token exchange failed: ${response.status}`);
        }

        const tokenData = await response.json() as any;

        // Validate required fields
        if (!tokenData.access_token || !tokenData.refresh_token || !tokenData.expires_in || !tokenData.locationId) {
            throw new Error('Incomplete token response from OAuth provider');
        }

        console.log(`Token exchange successful - Location: ${tokenData.locationId}, Expires: ${tokenData.expires_in}s`);

        return {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_in: tokenData.expires_in,
            locationId: tokenData.locationId,
            companyId: tokenData.companyId,
            userType: tokenData.userType,
            scope: tokenData.scope
        };
    }

    /**
     * Builds HTML response for OAuth callback result
     * @param result OAuth callback result
     * @returns HTML Response object
     */
    private buildHtmlResponse(result: OAuthCallbackResult): Response {
        const html = this.generateResultHtml(result);
        
        return new Response(html, {
            status: result.success ? 200 : 400,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    /**
     * Generates HTML content for OAuth result
     * @param result OAuth callback result
     * @returns HTML string
     */
    private generateResultHtml(result: OAuthCallbackResult): string {
        const status = result.success ? 'success' : 'error';
        const statusColor = result.success ? '#28a745' : '#dc3545';
        const icon = result.success ? '✅' : '❌';

        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>OAuth ${result.success ? 'Success' : 'Error'}</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                    background-color: #f8f9fa;
                }
                .container {
                    background: white;
                    padding: 2rem;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    text-align: center;
                    max-width: 500px;
                    width: 100%;
                }
                .status-icon {
                    font-size: 3rem;
                    margin-bottom: 1rem;
                }
                .status-message {
                    color: ${statusColor};
                    font-size: 1.5rem;
                    font-weight: 600;
                    margin-bottom: 1rem;
                }
                .details {
                    color: #6c757d;
                    margin-bottom: 1.5rem;
                }
                .data-section {
                    background-color: #f8f9fa;
                    padding: 1rem;
                    border-radius: 4px;
                    margin-top: 1rem;
                    text-align: left;
                }
                .data-item {
                    margin: 0.5rem 0;
                    font-family: monospace;
                    font-size: 0.9rem;
                }
                .close-btn {
                    background-color: ${statusColor};
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 1rem;
                }
                .close-btn:hover {
                    opacity: 0.9;
                }
                .error-details {
                    background-color: #f8d7da;
                    color: #721c24;
                    padding: 1rem;
                    border-radius: 4px;
                    margin-top: 1rem;
                    font-family: monospace;
                    font-size: 0.9rem;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="status-icon">${icon}</div>
                <div class="status-message">
                    Authentication ${result.success ? 'Successful' : 'Failed'}
                </div>
                <div class="details">
                    ${result.message}
                </div>
                
                ${result.success && result.data ? `
                <div class="data-section">
                    <strong>Authentication Details:</strong>
                    <div class="data-item">Location ID: ${result.data.locationId}</div>
                    <div class="data-item">Company ID: ${result.data.companyId || 'N/A'}</div>
                    <div class="data-item">User Type: ${result.data.userType || 'N/A'}</div>
                    <div class="data-item">Scope: ${result.data.scope || 'N/A'}</div>
                    <div class="data-item">Token Expires: ${result.data.expires_in}s</div>
                </div>
                <div style="margin-top: 1.5rem; padding: 1rem; background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 4px; color: #0c5460;">
                    <strong>✅ Authentication Complete!</strong><br>
                    <span style="font-size: 0.9rem;">You can now close this tab manually.</span><br>
                    <span style="font-size: 0.85rem; margin-top: 0.5rem; display: inline-block;">
                        <strong>Keyboard shortcut:</strong> 
                        <kbd style="background: #e9ecef; padding: 2px 4px; border-radius: 3px; margin: 0 2px;">Ctrl+W</kbd> (Windows/Linux) or 
                        <kbd style="background: #e9ecef; padding: 2px 4px; border-radius: 3px; margin: 0 2px;">Cmd+W</kbd> (Mac)
                    </span>
                </div>
                ` : ''}
                
                ${!result.success && result.error ? `
                <div class="error-details">
                    Error: ${result.error}
                </div>
                <button class="close-btn" onclick="window.location.reload()" style="margin-top: 1rem;">
                    Try Again
                </button>
                ` : ''}
            </div>
            
            <script>
                // No auto-close functionality - page remains static
                console.log('OAuth callback page loaded successfully');
            </script>
        </body>
        </html>
        `;
    }
}

/**
 * Factory function to create OAuth callback service
 * @param clientId OAuth client ID
 * @param clientSecret OAuth client secret
 * @param tokenUrl Optional custom token URL
 * @returns OAuthCallbackService instance
 */
export function createOAuthCallbackService(clientId: string, clientSecret: string, tokenUrl?: string): OAuthCallbackService {
    return new OAuthCallbackService(clientId, clientSecret, tokenUrl);
}
