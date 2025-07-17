# Token Management Service

A modular token validation and refresh service for OAuth token management in Cloudflare Workers.

## File Structure

```
src/utils/token-management/
├── token-validator.ts  # Main token validation service
├── examples.ts         # Usage examples and integration patterns
└── README.md          # This documentation file
```

## Features

- **Token Validation**: Check if access tokens are still valid by comparing expiration dates
- **Token Refresh**: Automatically refresh expired tokens using refresh tokens
- **Automatic Token Management**: Combine validation and refresh in a single method
- **Type-safe**: Full TypeScript support with proper interfaces
- **Modular**: Clean separation from durable object logic

## Quick Start

```typescript
import { createTokenValidator } from './utils/token-management/token-validator';

// Create token validator
const tokenValidator = createTokenValidator(
    credentialsStub,     // Your credentials durable object stub
    env.GHL_CLIENT_ID,   // OAuth client ID
    env.GHL_CLIENT_SECRET // OAuth client secret
);

// Validate a token
const validation = await tokenValidator.validateToken('location123');
if (validation.valid) {
    console.log('Token is valid');
} else {
    console.log('Token is invalid:', validation.message);
}

// Refresh a token
const refreshResult = await tokenValidator.refreshToken('location123');
if (refreshResult.success) {
    console.log('Token refreshed successfully');
}

// Ensure valid token (validates and refreshes if needed)
try {
    const validToken = await tokenValidator.ensureValidToken('location123');
    // Use validToken for API calls
} catch (error) {
    console.error('Failed to ensure valid token:', error.message);
}
```

## API Reference

### Classes

- `TokenValidator` - Main token validation and refresh service

### Interfaces

- `TokenValidationResult` - Result of token validation
  - `valid: boolean` - Whether the token is valid
  - `expiresAt?: string` - Token expiration date
  - `message?: string` - Status message

- `TokenRefreshResult` - Result of token refresh operation
  - `success: boolean` - Whether refresh was successful
  - `newAccessToken?: string` - The new access token
  - `newRefreshToken?: string` - The new refresh token
  - `expiresAt?: string` - New expiration date
  - `message?: string` - Status message

### Methods

#### `validateToken(locationId: string): Promise<TokenValidationResult>`
Validates if the token for a given location is still valid.

**Parameters:**
- `locationId` - The location ID to validate

**Returns:**
- `TokenValidationResult` indicating if token is valid

**Example:**
```typescript
const result = await tokenValidator.validateToken('location123');
if (result.valid) {
    console.log('Token expires at:', result.expiresAt);
} else {
    console.log('Token validation failed:', result.message);
}
```

#### `refreshToken(locationId: string): Promise<TokenRefreshResult>`
Refreshes the access token using the refresh token.

**Parameters:**
- `locationId` - The location ID to refresh token for

**Returns:**
- `TokenRefreshResult` with new token information

**Example:**
```typescript
const result = await tokenValidator.refreshToken('location123');
if (result.success) {
    console.log('New token expires at:', result.expiresAt);
    // New tokens are automatically stored in the database
} else {
    console.error('Refresh failed:', result.message);
}
```

#### `ensureValidToken(locationId: string): Promise<string>`
Ensures a valid token exists for the location, refreshing if necessary.

**Parameters:**
- `locationId` - The location ID to ensure valid token for

**Returns:**
- The valid access token

**Throws:**
- Error if token cannot be validated or refreshed

**Example:**
```typescript
try {
    const validToken = await tokenValidator.ensureValidToken('location123');
    
    // Use token for API calls
    const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${validToken}` }
    });
} catch (error) {
    console.error('Cannot ensure valid token:', error.message);
}
```

### Factory Functions

- `createTokenValidator(credentialsStub, clientId, clientSecret)` - Creates a TokenValidator instance

## Integration with Durable Objects

The service requires a new method in your `CredentialsDurableObject`:

```typescript
/**
 * Updates only the token pair (access_token, refresh_token, expires_at) for a location
 */
async updateTokenPair(locationId: string, newAccessToken: string, newRefreshToken: string, expiresAt: string) {
    // Implementation updates only token fields, preserving other data
}
```

This method has been added to your durable object and provides efficient token updates without affecting other credential data.

## Usage in Main Worker

### Basic Integration

```typescript
import { createTokenValidator } from './utils/token-management/token-validator';

export default {
    async fetch(request, env, ctx): Promise<Response> {
        const url = new URL(request.url);
        
        // Create durable object stub
        const id = env.CREDENTIALS_DURABLE_OBJECT.idFromName("credentials_do");
        const stub = env.CREDENTIALS_DURABLE_OBJECT.get(id);

        // Create token validator
        const tokenValidator = createTokenValidator(
            stub,
            env.GHL_CLIENT_ID,
            env.GHL_CLIENT_SECRET
        );

        // Use in your API endpoints
        if (url.pathname === '/getInventory') {
            const locationId = url.searchParams.get('location_id');
            
            try {
                const validToken = await tokenValidator.ensureValidToken(locationId);
                // Make API call with valid token
            } catch (error) {
                return new Response('Token validation failed', { status: 401 });
            }
        }
    }
}
```

### Replacing Existing Token Logic

Replace your existing `ensureValidToken` method calls in the durable object with the new service:

**Before:**
```typescript
// In durable object
const accessToken = await this.ensureValidToken(locationId);
```

**After:**
```typescript
// In main worker
const tokenValidator = createTokenValidator(stub, clientId, clientSecret);
const accessToken = await tokenValidator.ensureValidToken(locationId);
```

## Benefits

1. **Separation of Concerns**: Token logic is separated from durable object storage logic
2. **Reusability**: Can be used across different parts of your application
3. **Type Safety**: Full TypeScript support with proper error handling
4. **Efficiency**: Only updates token fields, preserving other credential data
5. **Testability**: Easy to unit test token validation logic independently

## Error Handling

The service provides comprehensive error handling:

- **Missing Parameters**: Validates all required inputs
- **Database Errors**: Handles cases where credentials are not found
- **Network Errors**: Catches and reports OAuth provider communication failures
- **Token Errors**: Handles invalid or incomplete token responses

All errors are returned as structured results with descriptive messages for easy debugging.

## Examples

### Example 1: Basic Token Validation Usage

```typescript
import { createTokenValidator } from './utils/token-management/token-validator';

export async function exampleTokenValidationUsage(request: Request, env: Env) {
    const url = new URL(request.url);
    const method = request.method;

    // Create durable object stub
    const id = env.CREDENTIALS_DURABLE_OBJECT.idFromName("credentials_do");
    const stub = env.CREDENTIALS_DURABLE_OBJECT.get(id);

    // Create token validator
    const tokenValidator = createTokenValidator(
        stub,
        env.GHL_CLIENT_ID!,
        env.GHL_CLIENT_SECRET!
    );

    // Example: Validate token for a specific location
    if (method === 'GET' && url.pathname === '/validate-token') {
        const locationId = url.searchParams.get('location_id');
        
        if (!locationId) {
            return new Response('Missing location_id parameter', { status: 400 });
        }

        const validation = await tokenValidator.validateToken(locationId);
        
        return new Response(JSON.stringify(validation), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Example: Refresh token for a specific location
    if (method === 'POST' && url.pathname === '/refresh-token') {
        const body = await request.json() as { location_id: string };
        
        if (!body.location_id) {
            return new Response('Missing location_id in request body', { status: 400 });
        }

        const refreshResult = await tokenValidator.refreshToken(body.location_id);
        
        return new Response(JSON.stringify(refreshResult), {
            headers: { 'Content-Type': 'application/json' },
            status: refreshResult.success ? 200 : 400
        });
    }

    return new Response('Not Found', { status: 404 });
}
```

### Example 2: Ensure Valid Token with Error Handling

```typescript
export async function ensureValidTokenExample(request: Request, env: Env) {
    const url = new URL(request.url);
    
    // Create durable object stub and token validator
    const id = env.CREDENTIALS_DURABLE_OBJECT.idFromName("credentials_do");
    const stub = env.CREDENTIALS_DURABLE_OBJECT.get(id);
    const tokenValidator = createTokenValidator(stub, env.GHL_CLIENT_ID!, env.GHL_CLIENT_SECRET!);

    // Example: Ensure valid token (validate and refresh if needed)
    if (url.pathname === '/ensure-valid-token') {
        const locationId = url.searchParams.get('location_id');
        
        if (!locationId) {
            return new Response('Missing location_id parameter', { status: 400 });
        }

        try {
            const validToken = await tokenValidator.ensureValidToken(locationId);
            
            return new Response(JSON.stringify({
                success: true,
                message: 'Valid token ensured',
                tokenPreview: validToken.slice(0, 10) + '...'
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
            
        } catch (error) {
            return new Response(JSON.stringify({
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error'
            }), {
                headers: { 'Content-Type': 'application/json' },
                status: 400
            });
        }
    }

    return new Response('Not Found', { status: 404 });
}
```

### Example 3: Integration with Inventory Service

```typescript
export async function getInventoryWithTokenValidator(locationId: string, env: Env) {
    // Create durable object stub
    const id = env.CREDENTIALS_DURABLE_OBJECT.idFromName("credentials_do");
    const stub = env.CREDENTIALS_DURABLE_OBJECT.get(id);

    // Create token validator
    const tokenValidator = createTokenValidator(
        stub,
        env.GHL_CLIENT_ID!,
        env.GHL_CLIENT_SECRET!
    );

    try {
        // Ensure we have a valid token (will refresh if needed)
        const validAccessToken = await tokenValidator.ensureValidToken(locationId);

        // Use the valid token to make API call
        const baseUrl = "https://services.leadconnectorhq.com/products/inventory";
        const headers = {
            'Accept': 'application/json',
            'Authorization': `Bearer ${validAccessToken}`,
            'Version': '2021-07-28'
        };

        const params = new URLSearchParams({
            limit: "100", // Adjust as needed
            altId: locationId,
            altType: "location"
        });

        const response = await fetch(`${baseUrl}?${params}`, { headers });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API call failed: ${response.status} - ${errorText}`);
        }

        const inventoryData = await response.json();
        return inventoryData;

    } catch (error) {
        console.error('Error in getInventoryWithTokenValidator:', error);
        throw error;
    }
}
```

### Example 4: Complete Main Worker Integration

```typescript
import { createTokenValidator } from './utils/token-management/token-validator';

export default {
    async fetch(request, env, ctx): Promise<Response> {
        const url = new URL(request.url);
        const method = request.method;

        // Create durable object stub
        const id = env.CREDENTIALS_DURABLE_OBJECT.idFromName("credentials_do");
        const stub = env.CREDENTIALS_DURABLE_OBJECT.get(id);

        // Create token validator
        const tokenValidator = createTokenValidator(
            stub,
            env.GHL_CLIENT_ID!,
            env.GHL_CLIENT_SECRET!
        );

        // Use in your inventory endpoint
        if (method === 'GET' && url.pathname === '/getInventory') {
            const locationId = url.searchParams.get('location_id');
            
            if (!locationId) {
                return new Response('Missing location_id parameter', { status: 400 });
            }

            try {
                // Ensure valid token (validates and refreshes if needed)
                const validToken = await tokenValidator.ensureValidToken(locationId);
                
                // Make API call with valid token
                const baseUrl = "https://services.leadconnectorhq.com/products/inventory";
                const headers = {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${validToken}`,
                    'Version': '2021-07-28'
                };

                const params = new URLSearchParams({
                    limit: "100",
                    altId: locationId,
                    altType: "location"
                });

                const inventoryResponse = await fetch(`${baseUrl}?${params}`, { headers });
                
                if (!inventoryResponse.ok) {
                    const errorText = await inventoryResponse.text();
                    return new Response(JSON.stringify({
                        error: 'API call failed',
                        details: errorText
                    }), { status: inventoryResponse.status });
                }

                const inventoryData = await inventoryResponse.json();
                return new Response(JSON.stringify(inventoryData), {
                    headers: { 'Content-Type': 'application/json' }
                });
                
            } catch (error) {
                return new Response(JSON.stringify({
                    error: 'Token validation failed',
                    message: error instanceof Error ? error.message : 'Unknown error'
                }), { 
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // Add token validation endpoints
        if (method === 'GET' && url.pathname === '/validate-token') {
            const locationId = url.searchParams.get('location_id');
            if (!locationId) {
                return new Response('Missing location_id parameter', { status: 400 });
            }

            const validation = await tokenValidator.validateToken(locationId);
            return new Response(JSON.stringify(validation), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (method === 'POST' && url.pathname === '/refresh-token') {
            const body = await request.json() as { location_id: string };
            if (!body.location_id) {
                return new Response('Missing location_id in request body', { status: 400 });
            }

            const refreshResult = await tokenValidator.refreshToken(body.location_id);
            return new Response(JSON.stringify(refreshResult), {
                headers: { 'Content-Type': 'application/json' },
                status: refreshResult.success ? 200 : 400
            });
        }

        // ... other routes

        return new Response('Not Found', { status: 404 });
    }
}
```

### Common Usage Patterns

#### Simple Token Validation
```typescript
const validation = await tokenValidator.validateToken('location123');
if (validation.valid) {
    console.log('Token is valid until:', validation.expiresAt);
} else {
    console.log('Token expired:', validation.message);
}
```

#### Token Refresh
```typescript
const refreshResult = await tokenValidator.refreshToken('location123');
if (refreshResult.success) {
    console.log('New token expires at:', refreshResult.expiresAt);
} else {
    console.error('Refresh failed:', refreshResult.message);
}
```

#### Automatic Token Management
```typescript
try {
    const validToken = await tokenValidator.ensureValidToken('location123');
    // Use validToken for API calls - guaranteed to be valid
    const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${validToken}` }
    });
} catch (error) {
    console.error('Cannot ensure valid token:', error.message);
}
```

## Testing the Service

You can test the token validation service using these endpoints:

1. **Validate Token**: `GET /validate-token?location_id=YOUR_LOCATION_ID`
2. **Refresh Token**: `POST /refresh-token` with body `{"location_id": "YOUR_LOCATION_ID"}`
3. **Ensure Valid Token**: `GET /ensure-valid-token?location_id=YOUR_LOCATION_ID`

All endpoints return JSON responses with detailed status information.
