import { CredentialsDurableObject } from "./durable-objects/credentials-durable-object";
import { ResponseBuilder } from "./common-types/response-builder";
import { 
    createOAuthInitiateRequestBuilder,
    createOAuthInitiationService,
    createOAuthCallbackService
} from "./services/authentication-service";

export { CredentialsDurableObject };

export default {
    /**
     * This is the standard fetch handler for a Cloudflare Worker
     *
     * @param request - The request submitted to the Worker from the client
     * @param env - The interface to reference bindings declared in wrangler.jsonc
     * @param ctx - The execution context of the Worker
     * @returns The response to be sent back to the client
     */
    async fetch(request, env, ctx): Promise<Response> {
        const url = new URL(request.url);
        const method = request.method;

        // Create a `DurableObjectId` for an instance of the `CredentialsDurableObject`
        // class named "CredentialsDurableObject". Requests from all Workers to the instance named
        // "CredentialsDurableObject" will go to a single globally unique Durable Object instance.
        const id: DurableObjectId = env.CREDENTIALS_DURABLE_OBJECT.idFromName("credentials_do");

        // Create a stub to open a communication channel with the Durable
        // Object instance.
        const stub = env.CREDENTIALS_DURABLE_OBJECT.get(id);

        // Handle GET /credentials - return all credentials
        if (method === 'GET' && url.pathname === '/credentials') {
            const url = new URL(request.url);
            const location_id = url.searchParams.get('location_id');
            if (location_id) {
                console.log(`Fetching credentials for location_id: ${location_id}`);
                const result = await stub.getCredentials(location_id);
                return ResponseBuilder.build(result.httpCode, result);
            }
            else {
                const result = await stub.getCredentials();
                const credentialsDB = [];
                
                // Handle the case where result.data might be a single object or array
                const dataArray = Array.isArray(result.data) ? result.data : [result.data];
                
                for (const credential of dataArray ?? []) {
                    credentialsDB.push(JSON.stringify(credential));
                }
                for (const credential of credentialsDB) {
                    console.log(`Credential: ${credential}`);
                }
                return ResponseBuilder.build(result.httpCode, credentialsDB);
            }
        }

        if (method === 'GET' && url.pathname === '/getInventory') {
            const url = new URL(request.url);
            const location_id = url.searchParams.get('location_id');
            
            if (!location_id) {
                return ResponseBuilder.build(400, {
                    status: 'ERROR',
                    message: 'location_id parameter is required'
                });
            }
            
            const response = await stub.get_inventory(location_id);
            console.log(`Response from get_inventory: ${JSON.stringify(response)}`);

            return new Response (response.body, {
                status: response.status,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
            }); 
        }

        // Handle OAuth initiation
        if (method === 'GET' && url.pathname === '/oauth/initiate') {
            console.log('OAuth initiation requested');
            
            const oauthRequest = createOAuthInitiateRequestBuilder()
                .setDomain(env.DOMAIN)
                .setClientId(env.GHL_CLIENT_ID!)
                .setScopes(['products.readonly', 'products/prices.readonly'])
                .build();

            const oauthService = createOAuthInitiationService();
            return oauthService.initiateOAuth(oauthRequest);
        }

        // Handle OAuth callback
        if (method === 'GET' && url.pathname === '/oauth/callback') {
            console.log('OAuth callback received');
            
            const callbackService = createOAuthCallbackService(
                env.GHL_CLIENT_ID!,
                env.GHL_CLIENT_SECRET!
            );

            const response = await callbackService.handleCallback(request);
            
            // If successful, extract token data and store credentials
            if (response.status === 200) {
                try {
                    // Parse the URL to get the code and exchange it for tokens
                    const callbackUrl = new URL(request.url);
                    const authCode = callbackUrl.searchParams.get('code');
                    
                    if (authCode) {
                        // Re-exchange the code to get token data for storage
                        // (This is a bit redundant but needed to extract the data)
                        const tokenParams = new URLSearchParams({
                            client_id: env.GHL_CLIENT_ID!,
                            client_secret: env.GHL_CLIENT_SECRET!,
                            grant_type: 'authorization_code',
                            code: authCode,
                            user_type: 'Location'
                        });

                        const tokenResponse = await fetch('https://services.leadconnectorhq.com/oauth/token', {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/x-www-form-urlencoded',
                            },
                            body: tokenParams.toString(),
                        });

                        if (tokenResponse.ok) {
                            const tokenData = await tokenResponse.json() as any;
                            
                            // Store credentials in database
                            const credentialResult = await stub.insertCredential({
                                location_id: tokenData.locationId,
                                company_id: tokenData.companyId,
                                access_token: tokenData.access_token,
                                refresh_token: tokenData.refresh_token,
                                expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
                                receiverEmails: [] // Default empty array
                            });

                            console.log('Credentials stored:', credentialResult.status);
                        }
                    }
                } catch (error) {
                    console.error('Error storing credentials:', error);
                }
            }

            return response;
        }

        // Handle POST /credentials - insert new credential
        if (method === 'POST' && url.pathname === '/credentials') {
            const body = await request.json() as any;
            
            // Validate required fields
            const requiredFields = ['location_id', 'company_id', 'access_token', 'refresh_token', 'expires_at'];
            const missingFields = requiredFields.filter(field => !body[field]);
            
            if (missingFields.length > 0) {
                const errorObject = {
                    status: 'ERROR',
                    errorCode: 'MISSING_FIELDS',
                    message: `Missing required fields: ${missingFields.join(', ')}`,
                    missingFields: missingFields
                };
                return ResponseBuilder.build(400, errorObject);
            }

            const result = await stub.insertCredential({
                location_id: body.location_id,
                company_id: body.company_id,
                access_token: body.access_token,
                refresh_token: body.refresh_token,
                expires_at: body.expires_at
            });

            return ResponseBuilder.build(result.httpCode, result);
        }

        // deletes the entire row of the selected location id. requires app password to execute.
        if (method === 'DELETE' && url.pathname.startsWith('/credentials/')) {
            const location_id = url.pathname.split('/').pop();
            console.log(`Deleting credential for location_id: ${location_id}`);
            if (!location_id) {
                return ResponseBuilder.build(400, {
                    status: 'ERROR',
                    errorCode: 'MISSING_LOCATION_ID',
                    message: 'Location ID is required'
                });
            }

            const result = await stub.deleteCredential(location_id);
            return ResponseBuilder.build(result.httpCode, result);
        }

        // Handle OPTIONS request for CORS
        if (method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                }
            });
        }

        // If no matching route, return 404
        return new Response("Not Found", {
            status: 404,
            headers: { 'Content-Type': 'text/plain' }
        });
    },
} satisfies ExportedHandler<Env>;
