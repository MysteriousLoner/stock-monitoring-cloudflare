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

    async getAllCredentials() {
        try {
            const results = this.sql.exec("SELECT * FROM credentials");
            const data = results.toArray();
            return {
                status: ResponseStatus.SUCCESS,
                httpCode: 200,
                message: "Credentials retrieved successfully",
                data: data
            };
        } catch (error) {
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
                INSERT INTO credentials (location_id, company_id, access_token, refresh_token, expires_at) 
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
}