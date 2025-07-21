import { DurableObject } from "cloudflare:workers";
import { ResponseStatus } from "../common-types/status";
import { EmailService } from "../email/email";

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

            this.ensureValidToken(locationId);

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

            // console.log(`Total inventory items for location_id ${locationId}: ${total}`);

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
            // console.log(`Fetched ${total} inventory items for location_id: ${locationId}`);

            if (!inventoryRes.ok) {
            const errText = await inventoryRes.text();
            return new Response(
                JSON.stringify({ error: "Failed to fetch full inventory", details: errText }),
                { status: inventoryRes.status, headers: { 'Content-Type': 'application/json' } }
            );
            }

            const inventoryData = await inventoryRes.json();

            const { lowstock, outofstock } = await this.queryInv(inventoryData.inventory);
 
            const emailService = new EmailService();

            const emailBody = await emailService.sendEmail(this.env.RESEND_API, lowstock, outofstock, inventoryData, locationId, this.env.EMAIL);

            return new Response(emailBody, {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
            });
            // return new Response(JSON.stringify(inventoryData), {
            // status: 200,
            // headers: { 'Content-Type': 'application/json' }
            // });

        } catch (e: any) {
            console.error("Unexpected error in get_inventory:", e);
            return new Response(
            JSON.stringify({ error: "Unexpected error", details: e.message || String(e) }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }
    }

    async queryInv(Inv: string[]) : Promise<{ outofstock: string[]; lowstock: string[] }> {
        if (!Inv || Inv.length === 0) {
            console.error("No inventory items provided for query");
            throw new Error("No inventory items provided for query");
        }

        let lowStockItems: string[] = [];
        let outOfStockItems: string[] = [];
        try {
            Inv.forEach(item => {
                if (item.availableQuantity == 0) {
                    outOfStockItems.push(`${item.productName} - ${item.name}`);
                } else if (item.availableQuantity < 2 && item.availableQuantity > 0) {
                    lowStockItems.push(`${item.productName} - ${item.name}`);
                }
            })
        } catch(e: any) {
            console.error(`Error querying inventory: ${e.message || e.toString()}`);
            throw new Error(`Error querying inventory: ${e.message || e.toString()}`);
        };

        // console.log(`Email body: ${emailBody}`);
        return {
            outofstock: outOfStockItems.join('\n'),
            lowstock: lowStockItems.join('\n'),
        };
    }

    async ensureValidToken(locationId: string): Promise<string> {
        if (!locationId) {
            console.error("Missing required parameter: location_id");
            throw new Error("Missing required parameter: location_id");
        }

        try {
            const credentials = await this.getCredentials(locationId);
            // console.log(`${JSON.stringify(credentials)}`);

            if (!credentials) {
            const errorMsg = `No credentials found for location_id: ${locationId}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
            }

            const { location_id, company_id, access_token, refresh_token, expires_at } = credentials.data;

            if (!access_token || !refresh_token || !expires_at) {
            throw new Error("Incomplete credentials stored");
            }

            const currentTime = Date.now();
            const expiresTime = new Date(expires_at).getTime();

            if (currentTime >= expiresTime) {
            console.log(`Token expired for location_id: ${locationId}, refreshing...`);

                const newCredentials = await this.refreshAccessToken(locationId);

                return newCredentials.access_token;
            }

            console.log(`Token still valid for location_id: ${locationId}`);
            return access_token;

        } catch (err: any) {
            console.error(`Error ensuring valid token: ${err.message || err.toString()}`);
            throw new Error(`Error ensuring valid token: ${err.message || err.toString()}`);
        }
    }
    
    async refreshAccessToken(locationId: string): Promise<boolean> {
        if (!locationId) {
            console.error("Missing required parameter: location_id");
            throw new Error("Missing required parameter: location_id");
        }
        
        try {
            const credentials = await this.getCredentials(locationId);
            // console.log(`${JSON.stringify(credentials)}`);
            // console.log(`Making token request to: ${(credentials.data.refresh_token)}`);
            
            if (!credentials || !credentials.data.refresh_token) {
                const errorMsg = `No refresh token found for location_id: ${locationId}`;
                console.error(errorMsg);
                throw new Error(errorMsg);
            }
            
            const tokenUrl = "https://services.leadconnectorhq.com/oauth/token";
            
            const params = new URLSearchParams();
            params.append("client_id", this.env.GHL_CLIENT_ID);
            params.append("client_secret", this.env.GHL_CLIENT_SECRET);
            params.append("grant_type", "refresh_token");
            params.append("refresh_token", credentials.data.refresh_token);
            params.append("user_type", "Location");
            
            console.log(`Refreshing access token for location_id: ${params}`);
            
            const response = await fetch(tokenUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                },
                body : params.toString(),
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to refresh token: ${errorText}`);
            }
            
            const tokenData = await response.json();
            
            const newAccessToken = tokenData.access_token;
            const newRefreshToken = tokenData.refresh_token;
            const expiresIn = tokenData.expires_in;
            const newCompanyId = tokenData.companyId;
            const newLocationId = tokenData.locationId;
            
            console.log(`New Access Token: ${newAccessToken?.slice(0, 10) ?? 'None'}...`);
            console.log(`New Refresh Token: ${newRefreshToken?.slice(0, 10) ?? 'None'}...`);
            console.log(`Expires In: ${expiresIn}`);
            console.log(`New Location ID: ${newLocationId}`);
            console.log(`New Company ID: ${newCompanyId}`);
            
            if (!newAccessToken || !newRefreshToken || !expiresIn) {
                const errorMsg = "Incomplete token response from refresh request";
                console.error(errorMsg);
                throw new Error(errorMsg);
            }
            
            const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
            
            await this.update_credential({
                location_id: locationId,
                company_id: newCompanyId,
                access_token: newAccessToken,
                refresh_token: newRefreshToken,
                expires_at: expiresAt,
            });
            
            console.log(`Successfully refreshed tokens for location_id: ${locationId}`);
            return true;
        } catch (err: any) {
            console.error(`Error during token refresh: ${err.message || err.toString()}`);
            throw new Error(`Token refresh failed: ${err.message || err.toString()}`);
        }
    }

    async update_credential(credential: {
        location_id: string;
        company_id: string;
        access_token: string;
        refresh_token: string;
        expires_at: string;
    }) {
        await this.deleteCredential(credential.location_id);
        console.log(`Updating credential for location_id: ${credential.location_id}`);
        console.log(`Company ID: ${credential.company_id}`);
        console.log(`Access Token: ${credential.access_token?.slice(0, 10) ?? 'None'}...`);
        console.log(`Refresh Token: ${credential.refresh_token?.slice(0, 10) ?? 'None'}...`);
        console.log(`Expires At: ${credential.expires_at}`);
        await this.insertCredential({
            location_id: credential.location_id,
            company_id: credential.company_id,
            access_token: credential.access_token,
            refresh_token: credential.refresh_token,
            expires_at: credential.expires_at
        });
    }
}

