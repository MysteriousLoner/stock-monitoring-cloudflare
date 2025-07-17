# Authentication Service

A clean, modular OAuth authentication service for Cloudflare Workers. This service handles the complete OAuth flow without requiring Durable Objects - just HTTP redirects and API calls.

## File Structure

```
src/services/authentication-service/
├── index.ts           # Main export file (barrel exports)
├── types.ts           # OAuth request/response interfaces and builders
├── oauth-initiate.ts  # OAuth initiation service (redirects to external auth)
├── oauth-callback.ts  # OAuth callback service (handles tokens and renders HTML)
└── example-call.ts    # Usage examples and demonstrations
```

## Features

- **No Durable Objects Required**: Pure HTTP-based OAuth flow
- **Type-safe**: Full TypeScript support with proper interfaces
- **Builder Pattern**: Fluent API for building OAuth requests
- **HTML Response**: Formatted success/error pages for OAuth callback
- **Error Handling**: Comprehensive error handling with user-friendly responses
- **Modular**: Clean separation between initiation and callback handling

## Quick Start

### Option 1: Using the Complete OAuth Handler (Recommended)

```typescript
import { createOAuthHandler } from './services/authentication-service';

// Create OAuth handler
const oauthHandler = createOAuthHandler(
    env.GHL_CLIENT_ID,
    env.GHL_CLIENT_SECRET,
    'https://your-worker.workers.dev',
    ['products.readonly', 'products/prices.readonly']
);

// Handle initiation
if (url.pathname === '/oauth/initiate') {
    return oauthHandler.handleInitiation();
}

// Handle callback with automatic credential storage
if (url.pathname === '/oauth/callback') {
    return oauthHandler.handleCallback(request, {
        insertCredential: async (credential) => {
            return await stub.insertCredential(credential);
        }
    });
}
```

### Option 2: Manual Service Usage

### 1. OAuth Initiation (Redirect to External Auth)

```typescript
import { createOAuthInitiateRequestBuilder, createOAuthInitiationService } from './services/authentication-service';

// Build OAuth request
const oauthRequest = createOAuthInitiateRequestBuilder()
    .setDomain('https://your-worker.workers.dev')
    .setClientId(env.GHL_CLIENT_ID)
    .setScopes(['products.readonly', 'products/prices.readonly'])
    .build();

// Initiate OAuth (returns redirect response)
const oauthService = createOAuthInitiationService();
return oauthService.initiateOAuth(oauthRequest);
```

### 2. OAuth Callback (Handle Response)

```typescript
import { createOAuthCallbackService } from './services/authentication-service';

// Handle OAuth callback
const callbackService = createOAuthCallbackService(
    env.GHL_CLIENT_ID,
    env.GHL_CLIENT_SECRET
);

return callbackService.handleCallback(request);
```

## Integration with Your Worker

### Simplified Integration with Complete OAuth Handler

```typescript
import { createOAuthHandler } from "./services/authentication-service";

export default {
    async fetch(request, env, ctx): Promise<Response> {
        const url = new URL(request.url);
        const method = request.method;

        // Create Durable Object stub for credential storage
        const id = env.CREDENTIALS_DURABLE_OBJECT.idFromName("credentials_do");
        const stub = env.CREDENTIALS_DURABLE_OBJECT.get(id);

        // Create OAuth handler once
        const oauthHandler = createOAuthHandler(
            env.GHL_CLIENT_ID,
            env.GHL_CLIENT_SECRET,
            env.DOMAIN,
            ['products.readonly', 'products/prices.readonly']
        );

        // OAuth initiation endpoint
        if (method === 'GET' && url.pathname === '/oauth/initiate') {
            return oauthHandler.handleInitiation();
        }

        // OAuth callback endpoint with automatic credential storage
        if (method === 'GET' && url.pathname === '/oauth/callback') {
            return oauthHandler.handleCallback(request, {
                insertCredential: async (credential) => {
                    return await stub.insertCredential(credential);
                }
            });
        }

        // ... other routes
    }
}
```

### Manual Integration (Advanced Usage)

```typescript
import { 
    createOAuthInitiateRequestBuilder,
    createOAuthInitiationService,
    createOAuthCallbackService
} from "./services/authentication-service";

// OAuth initiation endpoint
if (method === 'GET' && url.pathname === '/oauth/initiate') {
    const domain = `https://${request.headers.get('host')}`;
    
    const oauthRequest = createOAuthInitiateRequestBuilder()
        .setDomain(domain)
        .setClientId(env.GHL_CLIENT_ID)
        .setScopes(['products.readonly', 'products/prices.readonly'])
        .build();

    const oauthService = createOAuthInitiationService();
    return oauthService.initiateOAuth(oauthRequest);
}

// OAuth callback endpoint
if (method === 'GET' && url.pathname === '/oauth/callback') {
    const callbackService = createOAuthCallbackService(
        env.GHL_CLIENT_ID,
        env.GHL_CLIENT_SECRET
    );

    const response = await callbackService.handleCallback(request);
    
    // Store credentials if successful
    if (response.status === 200) {
        // Extract token data and store in your database
        // See examples section for complete implementation
    }

    return response;
}
```

## OAuth Flow

1. **Client calls `/oauth/initiate`**
   - Service builds authorization URL with client ID, scopes, redirect URI
   - Returns 302 redirect to external OAuth provider

2. **User authenticates on external provider**
   - External provider redirects back to `/oauth/callback` with authorization code

3. **Service handles `/oauth/callback`**
   - Exchanges authorization code for access/refresh tokens
   - Returns formatted HTML page showing success/failure
   - Optionally stores credentials in database

## Environment Variables Required

```bash
# OAuth credentials
GHL_CLIENT_ID=your-client-id
GHL_CLIENT_SECRET=your-client-secret
```

## API Reference

### Classes

- `OAuthHandler` - Complete OAuth handler that encapsulates the entire flow
  - `handleInitiation()` - Handles OAuth initiation and redirects
  - `handleCallback(request, credentialStorage?)` - Handles OAuth callbacks with optional credential storage

### Interfaces

- `OAuthInitiateRequest` - Parameters for OAuth initiation
- `OAuthTokenData` - Token data from OAuth provider
- `OAuthCallbackResult` - Result of OAuth callback processing

### Services

- `OAuthInitiationService` - Handles OAuth initiation and redirects
- `OAuthCallbackService` - Handles OAuth callbacks and token exchange

### Builders

- `OAuthInitiateRequestBuilder` - Fluent API for building OAuth requests

### Factory Functions

- `createOAuthHandler(clientId, clientSecret, domain, scopes?)` - Creates a complete OAuth handler

## Error Handling

The service provides comprehensive error handling:

- **Missing authorization code**: Returns user-friendly HTML error page
- **Token exchange failures**: Logs errors and shows detailed error information
- **Invalid requests**: Validates all required parameters before processing
- **Network errors**: Catches and handles all fetch/network related errors

## HTML Response Examples

### Success Page
- ✅ Green success indicator
- Shows token details (location ID, company ID, etc.)
- Auto-closes after 5 seconds
- Clean, professional styling

### Error Page
- ❌ Red error indicator  
- Shows error details for debugging
- Provides "Try Again" button
- Clear error messaging

## Advantages Over Previous Implementation

1. **No Durable Objects**: OAuth is stateless - no need for persistent objects
2. **Cleaner Code**: Separated concerns between initiation and callback
3. **Better UX**: Proper HTML responses instead of JSON
4. **Type Safety**: Full TypeScript support with validation
5. **Maintainable**: Modular structure with clear responsibilities
6. **Performance**: No unnecessary object creation or storage

## Examples

### Example 1: Complete OAuth Handler (Recommended)

```typescript
import { createOAuthHandler } from './services/authentication-service';

export async function handleOAuthWithHandler(request: Request, env: Env, stub: any): Promise<Response> {
    const url = new URL(request.url);
    
    // Create OAuth handler
    const oauthHandler = createOAuthHandler(
        env.GHL_CLIENT_ID,
        env.GHL_CLIENT_SECRET,
        env.DOMAIN,
        ['products.readonly', 'products/prices.readonly']
    );

    // Handle initiation
    if (url.pathname === '/oauth/initiate') {
        return oauthHandler.handleInitiation();
    }

    // Handle callback with automatic credential storage
    if (url.pathname === '/oauth/callback') {
        return oauthHandler.handleCallback(request, {
            insertCredential: async (credential) => {
                console.log('Storing credential for location:', credential.location_id);
                return await stub.insertCredential(credential);
            }
        });
    }

    return new Response('Not Found', { status: 404 });
}
```

### Example 2: OAuth Handler Without Credential Storage

```typescript
export async function handleOAuthBasic(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    const oauthHandler = createOAuthHandler(
        env.GHL_CLIENT_ID,
        env.GHL_CLIENT_SECRET,
        env.DOMAIN
    );

    if (url.pathname === '/oauth/initiate') {
        return oauthHandler.handleInitiation();
    }

    if (url.pathname === '/oauth/callback') {
        // Handle callback without automatic storage
        return oauthHandler.handleCallback(request);
    }

    return new Response('Not Found', { status: 404 });
}
```

### Example 3: Basic OAuth Initiation (Manual)

```typescript
import { createOAuthInitiateRequestBuilder, createOAuthInitiationService } from './services/authentication-service';

export async function basicOAuthInitiation(env: Env, domain: string): Promise<Response> {
    // Build OAuth request
    const oauthRequest = createOAuthInitiateRequestBuilder()
        .setDomain(domain)
        .setClientId(env.GHL_CLIENT_ID!)
        .setScopes(['products.readonly', 'products/prices.readonly'])
        .build();

    // Create service and initiate OAuth
    const oauthService = createOAuthInitiationService();
    return oauthService.initiateOAuth(oauthRequest);
}
```

### Example 2: OAuth with Custom Redirect URI

```typescript
export async function customRedirectOAuthInitiation(env: Env, domain: string, customRedirectPath: string): Promise<Response> {
    const oauthRequest = createOAuthInitiateRequestBuilder()
        .setDomain(domain)
        .setClientId(env.GHL_CLIENT_ID!)
        .addScope('products.readonly')
        .addScope('products/prices.readonly')
        .addScope('locations.readonly') // Adding additional scope
        .setRedirectUri(`${domain}${customRedirectPath}`)
        .build();

    const oauthService = createOAuthInitiationService();
    return oauthService.initiateOAuth(oauthRequest);
}
```

### Example 3: OAuth Callback Handling

```typescript
import { createOAuthCallbackService } from './services/authentication-service';

export async function handleOAuthCallback(request: Request, env: Env): Promise<Response> {
    // Create callback service
    const callbackService = createOAuthCallbackService(
        env.GHL_CLIENT_ID!,
        env.GHL_CLIENT_SECRET!
    );

    // Handle the callback
    return callbackService.handleCallback(request);
}
```

### Example 4: Complete OAuth Flow with Credential Storage

```typescript
export async function completeOAuthFlow(request: Request, env: Env): Promise<Response> {
    try {
        // Handle OAuth callback
        const callbackService = createOAuthCallbackService(
            env.GHL_CLIENT_ID!,
            env.GHL_CLIENT_SECRET!
        );

        const response = await callbackService.handleCallback(request);
        
        // If callback was successful, extract the data and store credentials
        if (response.status === 200) {
            console.log('OAuth successful, would store credentials in database');
            
            // Example of what the storage call would look like:
            const credentialsStub = env.CREDENTIALS_DURABLE_OBJECT.get(
                env.CREDENTIALS_DURABLE_OBJECT.idFromName("credentials_do")
            );
            
            // Note: You would need to parse the response to extract token data first
            /*
            await credentialsStub.insertCredential({
                location_id: tokenData.locationId,
                company_id: tokenData.companyId,
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
                receiverEmails: [] // Could be populated from request or default
            });
            */
        }

        return response;

    } catch (error) {
        console.error('Complete OAuth flow error:', error);
        
        const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>OAuth Error</title></head>
        <body>
            <h1>Authentication Error</h1>
            <p>An unexpected error occurred during authentication.</p>
            <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
        </body>
        </html>
        `;

        return new Response(errorHtml, {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }
}
```

### Example 5: Multi-Provider OAuth

```typescript
export async function multiProviderOAuth(provider: 'ghl' | 'custom', env: Env, domain: string): Promise<Response> {
    let baseUrl: string;
    let scopes: string[];
    
    switch (provider) {
        case 'ghl':
            baseUrl = 'https://marketplace.gohighlevel.com/oauth/chooselocation';
            scopes = ['products.readonly', 'products/prices.readonly'];
            break;
        case 'custom':
            baseUrl = 'https://custom-provider.com/oauth/authorize';
            scopes = ['read', 'write'];
            break;
        default:
            throw new Error('Unsupported provider');
    }

    const oauthRequest = createOAuthInitiateRequestBuilder()
        .setDomain(domain)
        .setClientId(env.GHL_CLIENT_ID!)
        .setScopes(scopes)
        .build();

    const oauthService = createOAuthInitiationService(baseUrl);
    return oauthService.initiateOAuth(oauthRequest);
}
```

### Example 6: Error Handling and Validation

```typescript
export async function errorHandlingExample(): Promise<void> {
    try {
        // This will throw an error due to missing required fields
        const invalidRequest = createOAuthInitiateRequestBuilder()
            .setDomain('https://example.com')
            // Missing client ID and scopes
            .build();
            
        console.log('This should not print - validation should have failed');
    } catch (error) {
        console.log('✅ Validation worked correctly:', (error as Error).message);
    }

    try {
        // This will also throw an error
        const anotherInvalidRequest = createOAuthInitiateRequestBuilder()
            .setDomain('https://example.com')
            .setClientId('test-client-id')
            // Missing scopes
            .build();
            
        console.log('This should not print - validation should have failed');
    } catch (error) {
        console.log('✅ Validation worked correctly:', (error as Error).message);
    }
}
```

### Common Usage Patterns

#### Basic OAuth Initiation
```typescript
// Basic OAuth initiation
const oauthRequest = createOAuthInitiateRequestBuilder()
    .setDomain('https://your-worker.workers.dev')
    .setClientId(env.GHL_CLIENT_ID)
    .setScopes(['products.readonly', 'products/prices.readonly'])
    .build();

const service = createOAuthInitiationService();
return service.initiateOAuth(oauthRequest);
```

#### Callback Handling
```typescript
// OAuth callback handling
const callbackService = createOAuthCallbackService(
    env.GHL_CLIENT_ID,
    env.GHL_CLIENT_SECRET
);

return callbackService.handleCallback(request);
```

#### Custom Scopes
```typescript
// OAuth with custom scopes
const oauthRequest = createOAuthInitiateRequestBuilder()
    .setDomain('https://your-worker.workers.dev')
    .setClientId(env.GHL_CLIENT_ID)
    .addScope('products.readonly')
    .addScope('products/prices.readonly')
    .addScope('locations.readonly')
    .build();
```

## Testing

The examples above provide comprehensive coverage including:
- Basic OAuth flow
- Custom redirect URIs
- Multi-provider support
- Error handling scenarios
- Complete integration examples
