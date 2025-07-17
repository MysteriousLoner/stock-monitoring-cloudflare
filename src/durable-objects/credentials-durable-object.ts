import { DurableObject } from "cloudflare:workers";
import { ResponseStatus } from "../common-types/status";

export class CredentialsDurableObject extends DurableObject<Env> {
    sql: SqlStorage;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.sql = ctx.storage.sql;
        
        // Drop the existing table and create new one with receiverEmails column
        // this.sql.exec(`DROP TABLE IF EXISTS credentials;`);
        
        this.sql.exec(`CREATE TABLE credentials(
            location_id TEXT PRIMARY KEY,
            company_id TEXT,
            access_token TEXT,
            refresh_token TEXT,
            expires_at TIMESTAMP,
            receiverEmails TEXT DEFAULT '[]'
        );`);
    }

    // Helper method to convert string array to JSON string for storage
    private arrayToJson(emails: string[]): string {
        return JSON.stringify(emails || []);
    }

    // Helper method to convert JSON string back to string array
    private jsonToArray(jsonString: string): string[] {
        try {
            const parsed = JSON.parse(jsonString || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    async getCredentials(locationId?: string) {
        try {
            if (locationId) {
                const stmt = this.sql.exec("SELECT * FROM credentials WHERE location_id = ?", locationId);
                const result = stmt.one();

                if (!result) {
                    return {
                        status: ResponseStatus.NOT_FOUND,
                        httpCode: 404,
                        message: `No credentials found for locationId: ${locationId}`
                    };
                }

                // Convert receiverEmails back to array
                const processedResult = {
                    ...result,
                    receiverEmails: this.jsonToArray(result.receiverEmails as string)
                };

                return {
                    status: ResponseStatus.SUCCESS,
                    httpCode: 200,
                    message: "Credential retrieved successfully",
                    data: processedResult
                };
            } else {
                // No locationId provided — return all
                const results = this.sql.exec("SELECT * FROM credentials");
                const data = results.toArray();

                // Process all results to convert receiverEmails
                const processedData = data.map(result => ({
                    ...result,
                    receiverEmails: this.jsonToArray(result.receiverEmails as string)
                }));

                return {
                    status: ResponseStatus.SUCCESS,
                    httpCode: 200,
                    message: "All credentials retrieved successfully",
                    data: processedData
                };
            }
        } catch (error) {
            console.error("Database error in getCredentials:", error);
            return {
                status: ResponseStatus.ERROR,
                httpCode: 500,
                errorCode: 'DATABASE_ERROR',
                message: "Failed to retrieve credentials from database"
            };
        }
    }

    async insertCredential(credential: {
        location_id: string;
        company_id: string;
        access_token: string;
        refresh_token: string;
        expires_at: string;
        receiverEmails?: string[]; // Optional for backward compatibility
    }) {
        const { location_id, company_id, access_token, refresh_token, expires_at, receiverEmails = [] } = credential;

        console.log(`Inserting credential for location_id: ${location_id}, company_id: ${company_id}`);
        try {
            // Check if location_id already exists
            const existingResults = this.sql.exec("SELECT location_id FROM credentials WHERE location_id = ?", location_id);
            const existing = existingResults.toArray();
            
            if (existing.length > 0) {
                return {
                    status: ResponseStatus.ERROR,
                    httpCode: 409,
                    errorCode: 'DUPLICATE_LOCATION',
                    message: `Location ID '${location_id}' already exists`
                };
            }

            // Convert receiverEmails array to JSON string
            const receiverEmailsJson = this.arrayToJson(receiverEmails);

            // Insert new credential with receiverEmails
            const result = this.sql.exec(`
                INSERT OR REPLACE INTO credentials (location_id, company_id, access_token, refresh_token, expires_at, receiverEmails) 
                VALUES (?, ?, ?, ?, ?, ?)
            `, location_id, company_id, access_token, refresh_token, expires_at, receiverEmailsJson);
            
            return {
                status: ResponseStatus.SUCCESS,
                httpCode: 201,
                message: "Credential inserted successfully",
                data: { insertedId: location_id }
            };
        } catch (error) {
            return {
                status: ResponseStatus.ERROR,
                httpCode: 500,
                errorCode: 'DATABASE_ERROR',
                message: `Failed to insert credential: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // New method to update receiverEmails for a location
    async updateReceiverEmails(location_id: string, receiverEmails: string[]) {
        try {
            // Check if credential exists
            const existing = this.sql.exec("SELECT 1 FROM credentials WHERE location_id = ?", location_id);
            if (!existing.one()) {
                return {
                    status: ResponseStatus.ERROR,
                    httpCode: 404,
                    errorCode: 'NOT_FOUND',
                    message: `Credential with location_id '${location_id}' not found`
                };
            }

            const receiverEmailsJson = this.arrayToJson(receiverEmails);
            
            this.sql.exec(
                "UPDATE credentials SET receiverEmails = ? WHERE location_id = ?", 
                receiverEmailsJson, 
                location_id
            );

            return {
                status: ResponseStatus.SUCCESS,
                httpCode: 200,
                message: "Receiver emails updated successfully",
                data: { location_id, receiverEmails }
            };
        } catch (error) {
            return {
                status: ResponseStatus.ERROR,
                httpCode: 500,
                errorCode: 'DATABASE_ERROR',
                message: `Failed to update receiver emails: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async deleteCredential(location_id: string) {
        try {
            const existing = this.sql.exec("SELECT 1 FROM credentials WHERE location_id = ?", location_id);
            if (!existing.one()) {
                return {
                    status: ResponseStatus.ERROR,
                    httpCode: 404,
                    errorCode: 'NOT_FOUND',
                    message: `Credential with location_id '${location_id}' not found`
                };
            }

            this.sql.exec("DELETE FROM credentials WHERE location_id = ?", location_id);
            return {
                status: ResponseStatus.SUCCESS,
                httpCode: 200,
                message: "Credential deleted successfully"
            };
        } catch (error) {
            return {
                status: ResponseStatus.ERROR,
                httpCode: 500,
                errorCode: 'DATABASE_ERROR',
                message: `Failed to delete credential: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async get_inventory(locationId: string): Promise<Response> {
        try {
            if (!locationId) {
                return new Response(
                    JSON.stringify({ error: "Missing required parameter: location_id" }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                );
            }

            const accessToken = await this.getCredentials(locationId);

            const baseUrl = "https://services.leadconnectorhq.com/products/inventory";
            const headers = {
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken?.data.access_token}`,
                'Version': '2021-07-28'
            };

            // Step 1: Get total count
            const countParams = new URLSearchParams({
                limit: "0",
                altId: locationId,
                altType: "location"
            });

            const countRes = await fetch(`${baseUrl}?${countParams}`, { headers });

            if (!countRes.ok) {
                const errText = await countRes.text();
                return new Response(
                    JSON.stringify({ error: "Failed to fetch inventory count", details: errText }),
                    { status: countRes.status, headers: { 'Content-Type': 'application/json' } }
                );
            }

            const countData = await countRes.json();
            const total = countData?.total?.[0]?.total || 0;

            console.log(`Total inventory items for location_id ${locationId}: ${total}`);

            if (total === 0) {
                return new Response(JSON.stringify({
                    inventory: [],
                    total: [{ total: 0 }],
                    traceId: countData.traceId || ''
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }

            // Step 2: Fetch all items
            const allParams = new URLSearchParams({
                limit: String(total),
                altId: locationId,
                altType: "location"
            });

            const inventoryRes = await fetch(`${baseUrl}?${allParams}`, { headers });
            console.log(`Fetched ${total} inventory items for location_id: ${locationId}`);

            if (!inventoryRes.ok) {
                const errText = await inventoryRes.text();
                return new Response(
                    JSON.stringify({ error: "Failed to fetch full inventory", details: errText }),
                    { status: inventoryRes.status, headers: { 'Content-Type': 'application/json' } }
                );
            }

            const inventoryData = await inventoryRes.json();

            return new Response(JSON.stringify(inventoryData), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });

        } catch (e: any) {
            console.error("Unexpected error in get_inventory:", e);
            return new Response(
                JSON.stringify({ error: "Unexpected error", details: e.message || String(e) }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }
    }
}