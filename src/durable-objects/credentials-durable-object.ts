import { DurableObject } from "cloudflare:workers";
import { ResponseStatus } from "../common-types/status";

export class CredentialsDurableObject extends DurableObject<Env> {
    sql: SqlStorage;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.sql = ctx.storage.sql;
        
        this.sql.exec(`CREATE TABLE IF NOT EXISTS credentials(
            location_id TEXT PRIMARY KEY,
            company_id TEXT,
            access_token TEXT,
            refresh_token TEXT,
            expires_at TIMESTAMP
        );`);
    }

    async getCredentials(locationId?: string) {
    try {
        if (locationId) {
        const stmt = this.sql.exec("SELECT * FROM credentials WHERE location_id = ?", locationId);
        const result = stmt.one();

        // console.log(`Access token for location_id ${locationId}:`, result?.access_token);
        if (!result) {
            return {
            status: ResponseStatus.NOT_FOUND,
            httpCode: 404,
            message: `No credentials found for locationId: ${locationId}`
            };
        }

        return {
            status: ResponseStatus.SUCCESS,
            httpCode: 200,
            message: "Credential retrieved successfully",
            data: result
        };
        } else {
        // No locationId provided — return all
        const results = this.sql.exec("SELECT * FROM credentials");
        const data = results.toArray();

        return {
            status: ResponseStatus.SUCCESS,
            httpCode: 200,
            message: "All credentials retrieved successfully",
            data: data
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
    }) {
        const { location_id, company_id, access_token, refresh_token, expires_at } = credential;


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

            // Insert new credential
            const result = this.sql.exec(`
                INSERT OR REPLACE INTO credentials (location_id, company_id, access_token, refresh_token, expires_at) 
                VALUES (?, ?, ?, ?, ?)
            `, location_id, company_id, access_token, refresh_token, expires_at);
            
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

    async deleteCredential(location_id: string) {
        try {
            const existing = await this.sql.exec("SELECT 1 FROM credentials WHERE location_id = ?", location_id);
            if (!existing) {
                return {
                    status: ResponseStatus.ERROR,
                    httpCode: 404,
                    errorCode: 'NOT_FOUND',
                    message: `Credential with location_id '${location_id}' not found`
                };
            }

            await this.sql.exec("DELETE FROM credentials WHERE location_id = ?", location_id);
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
            // console.log(`Access Token for location_id ${accessToken.data.access_token}:`);
            // console.log(`Access Token: ${accessToken?.data.access_token?.slice(0, 10) ?? 'None'}...`);

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
            // console.log(`Fetched ${JSON.stringify(inventoryData)}`);

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