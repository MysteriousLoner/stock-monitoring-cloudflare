/**
 * Simplified Response Builder
 * Takes HTTP status code and result object, stringifies result into response body
 */
export class ResponseBuilder {
    /**
     * Build a response with the given HTTP status code and result
     * @param httpCode - HTTP status code (e.g., 200, 400, 500)
     * @param result - Result object to be stringified as response body
     * @returns Response object
     */
    static build(httpCode: number, result: any): Response {
        return new Response(JSON.stringify(result, null, 2), {
            status: httpCode,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}
