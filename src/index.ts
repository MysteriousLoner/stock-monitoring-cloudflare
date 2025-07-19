import { CredentialsDurableObject } from "./durable-objects/credentials-durable-object";
import { ResponseBuilder } from "./common-types/response-builder";
import { createOAuthHandler } from "./services/authentication-service";
import { createInventoryQueryService } from "./services/inventory-query-service";

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

        /**
         * Oauth endpoints start. -----------------------------------------------------
         */
        // Handle OAuth initiation
        if (method === 'GET' && url.pathname === '/oauth/initiate') {
            console.log('OAuth initiation requested');
            
            const oauthHandler = createOAuthHandler(
                env.GHL_CLIENT_ID!,
                env.GHL_CLIENT_SECRET!,
                env.DOMAIN,
                ['products.readonly', 'products/prices.readonly']
            );
            
            return oauthHandler.handleInitiation();
        }
        
        // Handle OAuth callback
        if (method === 'GET' && url.pathname === '/oauth/callback') {
            console.log('OAuth callback received');
            
            const oauthHandler = createOAuthHandler(
                env.GHL_CLIENT_ID!,
                env.GHL_CLIENT_SECRET!,
                env.DOMAIN
            );
            
            // Pass the credential storage interface to the handler
            return oauthHandler.handleCallback(request, {
                insertCredential: async (credential) => {
                    return await stub.insertCredential(credential);
                }
            });
        }
        /**
         * Oauth endpoints end. -----------------------------------------------------
         */
        
        /**
         * Test endpoints start. -----------------------------------------------------
         */
        // Handle GET /credentials - return all credentials
        if (method === 'GET' && url.pathname === '/test/show-all-credentials') {
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

        // Handle POST /credentials - insert new credential
        if (method === 'POST' && url.pathname === '/test/remove-credentials') {
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

        // Inventory summary endpoint using the simplified inventory service
        if (method === 'GET' && url.pathname === '/getInventory') {
            const location_id = url.searchParams.get('location_id');
            
            if (!location_id) {
                return ResponseBuilder.build(400, {
                    status: 'ERROR',
                    message: 'location_id parameter is required'
                });
            }

            try {
                // Create inventory query service
                const inventoryService = createInventoryQueryService(
                    stub,
                    env.GHL_CLIENT_ID!,
                    env.GHL_CLIENT_SECRET!
                );

                // Get inventory summary
                const summary = await inventoryService.queryInventorySummary(location_id);

                console.log(`Inventory summary result: location=${summary.location_id}, total=${summary.total_items}, available=${summary.total_available_quantity}`);

                // Return formatted response
                return ResponseBuilder.build(200, {
                    status: 'SUCCESS',
                    message: `Successfully retrieved inventory summary for location ${location_id}`,
                    data: summary
                });

            } catch (error) {
                console.error('Error in inventory summary endpoint:', error);
                return ResponseBuilder.build(500, {
                    status: 'ERROR',
                    message: 'Internal server error during inventory query',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        /**
         * Test endpoints end. -----------------------------------------------------
         */

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
