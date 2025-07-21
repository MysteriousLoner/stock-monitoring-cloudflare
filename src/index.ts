import { CredentialsDurableObject } from "./durable-objects/credentials-durable-object";
import { ResponseBuilder } from "./common-types/response-builder";
import { createOAuthHandler } from "./services/authentication-service";
import { createInventoryQueryService } from "./services/inventory-query-service";
import { createEmailUpdateService } from "./services/email-update-service";
import { createUpdateAllClientStockStatus } from "./processes/update-all-client-stock-status";

export { CredentialsDurableObject };

/**
 * Validates the app password from request body
 * @param body - The request body containing appPassword
 * @param env - Environment variables containing APP_PASSWORD
 * @returns Response object if validation fails, null if validation passes
 */
function validateAppPassword(body: any, env: Env): Response | null {
    if (!body.appPassword || body.appPassword !== env.APP_PASSWORD) {
        return ResponseBuilder.build(401, {
            status: 'ERROR',
            errorCode: 'INVALID_PASSWORD',
            message: 'Invalid or missing app password'
        });
    }
    return null;
}

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

        // Strip /stock-monitoring prefix if present (Cloudflare routing handles this)
        let pathname = url.pathname;
        if (pathname.startsWith('/stock-monitoring')) {
            pathname = pathname.replace('/stock-monitoring', '') || '/';
        }

        console.log(`Request received: ${method} ${pathname}`);

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
        if (method === 'GET' && pathname === '/oauth/initiate') {
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
        if (method === 'GET' && pathname === '/oauth/callback') {
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
        // Handle POST /credentials - return all credentials (requires app password)
        if (method === 'POST' && pathname === '/test/show-all-credentials') {
            try {
                const body = await request.json() as any;
                
                // Validate app password
                const passwordError = validateAppPassword(body, env);
                if (passwordError) return passwordError;

                const location_id = body.location_id;
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
            } catch (error) {
                console.error('Error in show-all-credentials endpoint:', error);
                return ResponseBuilder.build(400, {
                    status: 'ERROR',
                    errorCode: 'INVALID_REQUEST',
                    message: 'Invalid JSON in request body'
                });
            }
        }

        // Handle POST /credentials - insert new credential (requires app password)
        if (method === 'POST' && pathname === '/test/remove-credentials') {
            try {
                const body = await request.json() as any;
                
                // Validate app password
                const passwordError = validateAppPassword(body, env);
                if (passwordError) return passwordError;
                
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
            } catch (error) {
                console.error('Error in remove-credentials endpoint:', error);
                return ResponseBuilder.build(400, {
                    status: 'ERROR',
                    errorCode: 'INVALID_REQUEST',
                    message: 'Invalid JSON in request body'
                });
            }
        }

        // Inventory summary endpoint using the simplified inventory service (requires app password)
        if (method === 'POST' && pathname === '/test/getInventory') {
            try {
                const body = await request.json() as any;
                
                // Validate app password
                const passwordError = validateAppPassword(body, env);
                if (passwordError) return passwordError;

                const location_id = body.location_id;
                
                if (!location_id) {
                    return ResponseBuilder.build(400, {
                        status: 'ERROR',
                        message: 'location_id parameter is required'
                    });
                }

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

        // Update receiver emails endpoint
        if (method === 'POST' && pathname === '/updateEmail') {
            try {
                const body = await request.json() as any;
                
                // Create email update service
                const emailUpdateService = createEmailUpdateService(
                    stub,
                    env.APP_PASSWORD!
                );

                // Process the update request
                const result = await emailUpdateService.updateReceiverEmails({
                    locationId: body.locationId,
                    appPassword: body.appPassword,
                    emailList: body.emailList
                });

                // Return appropriate HTTP status based on result
                const httpStatus = result.status === 'SUCCESS' ? 200 : 
                                  result.errorCode === 'INVALID_PASSWORD' ? 401 :
                                  result.errorCode === 'MISSING_LOCATION_ID' || 
                                  result.errorCode === 'MISSING_PASSWORD' || 
                                  result.errorCode === 'INVALID_EMAIL_LIST' ||
                                  result.errorCode === 'INVALID_EMAIL_FORMAT' ? 400 : 500;

                return ResponseBuilder.build(httpStatus, result);

            } catch (error) {
                console.error('Error in update email endpoint:', error);
                return ResponseBuilder.build(400, {
                    status: 'ERROR',
                    errorCode: 'INVALID_REQUEST',
                    message: 'Invalid JSON in request body'
                });
            }
        }

        // Test update all clients stock status endpoint (requires app password)
        if (method === 'POST' && pathname === '/test/updateClients') {
            try {
                const body = await request.json() as any;
                
                // Validate app password
                const passwordError = validateAppPassword(body, env);
                if (passwordError) return passwordError;

                console.log('Starting UpdateAllClientStockStatus process...');
                
                // Create the stock status updater
                const stockStatusUpdater = createUpdateAllClientStockStatus({
                    credentialsStub: stub,
                    clientId: env.GHL_CLIENT_ID!,
                    clientSecret: env.GHL_CLIENT_SECRET!,
                    resendApiKey: env.RESEND_API_KEY!,
                    senderEmail: env.RESEND_DOMAIN // Default sender email for testing
                });

                // Process all clients
                const result = await stockStatusUpdater.processAllClients();

                console.log('UpdateAllClientStockStatus process completed successfully');

                // Return formatted response
                return ResponseBuilder.build(200, {
                    status: 'SUCCESS',
                    message: 'Stock status update process completed',
                    data: {
                        summary: {
                            processedLocations: result.processedLocations,
                            emailsSent: result.emailsSent,
                            errorsCount: result.errors.length,
                            locationsWithoutEmails: result.locationsWithoutEmails,
                            locationsWithoutStock: result.locationsWithoutStock
                        },
                        details: result.errors.length > 0 ? {
                            errors: result.errors
                        } : undefined
                    }
                });

            } catch (error) {
                console.error('Error in UpdateAllClientStockStatus process:', error);
                return ResponseBuilder.build(500, {
                    status: 'ERROR',
                    message: 'Failed to process stock status updates',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        // Test scheduled event handler endpoint (requires app password)
        if (method === 'POST' && pathname === '/test/scheduledEvent') {
            try {
                const body = await request.json() as any;
                
                // Validate app password
                const passwordError = validateAppPassword(body, env);
                if (passwordError) return passwordError;

                console.log('Manually triggering scheduled event logic...');
                
                // Run the same logic as the scheduled event
                const stockStatusUpdater = createUpdateAllClientStockStatus({
                    credentialsStub: stub,
                    clientId: env.GHL_CLIENT_ID!,
                    clientSecret: env.GHL_CLIENT_SECRET!,
                    resendApiKey: env.RESEND_API_KEY!,
                    senderEmail: 'stock-alerts@ly-utilies-portal.stream'
                });

                console.log('Starting scheduled stock status update process...');
                const result = await stockStatusUpdater.processAllClients();

                console.log('Scheduled stock status update completed successfully');

                return ResponseBuilder.build(200, {
                    status: 'SUCCESS',
                    message: 'Scheduled event logic executed successfully (manual trigger)',
                    data: {
                        triggeredAt: new Date().toISOString(),
                        summary: {
                            processedLocations: result.processedLocations,
                            emailsSent: result.emailsSent,
                            errorsCount: result.errors.length,
                            locationsWithoutEmails: result.locationsWithoutEmails,
                            locationsWithoutStock: result.locationsWithoutStock
                        }
                    }
                });

            } catch (error) {
                console.error('Error in scheduled event logic:', error);
                return ResponseBuilder.build(500, {
                    status: 'ERROR',
                    message: 'Failed to execute scheduled event logic',
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

    /**
     * Scheduled event handler for cron jobs
     * Runs stock status updates twice daily at 8 AM and 8 PM UTC
     */
    async scheduled(event, env, ctx): Promise<void> {
        console.log('Scheduled event triggered at:', new Date().toISOString());
        console.log('Cron schedule:', event.cron);

        try {
            // Create a DurableObjectId for credentials access
            const id: DurableObjectId = env.CREDENTIALS_DURABLE_OBJECT.idFromName("credentials_do");
            const stub = env.CREDENTIALS_DURABLE_OBJECT.get(id);

            // Create the stock status updater
            const stockStatusUpdater = createUpdateAllClientStockStatus({
                credentialsStub: stub,
                clientId: env.GHL_CLIENT_ID!,
                clientSecret: env.GHL_CLIENT_SECRET!,
                resendApiKey: env.RESEND_API_KEY!,
                senderEmail: 'stock-alerts@ly-utilies-portal.stream'
            });

            console.log('Starting scheduled stock status update process...');

            // Process all clients
            const result = await stockStatusUpdater.processAllClients();

            console.log('Scheduled stock status update completed successfully');
            console.log(`Summary: Processed ${result.processedLocations} locations, sent ${result.emailsSent} emails`);
            console.log(`Skipped: ${result.locationsWithoutEmails} without emails, ${result.locationsWithoutStock} without stock issues`);

            if (result.errors.length > 0) {
                console.error(`Encountered ${result.errors.length} errors during processing:`, result.errors);
            }

        } catch (error) {
            console.error('Error in scheduled stock status update:', error);
            // You might want to send an alert to admins here
            throw error; // This will mark the scheduled event as failed in Cloudflare
        }
    },
} satisfies ExportedHandler<Env>;
