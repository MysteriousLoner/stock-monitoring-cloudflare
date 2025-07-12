import { CredentialsDurableObject } from "./durable-objects/credentials-durable-object";
import { ResponseBuilder } from "./common-types/response-builder";

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
            const result = await stub.getAllCredentials();
            return ResponseBuilder.build(result.httpCode, result);
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
