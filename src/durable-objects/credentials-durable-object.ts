import { DurableObject } from "cloudflare:workers";
import { ResponseStatus } from "../common-types/status";

export class CredentialsDurableObject extends DurableObject<Env> {
    sql: SqlStorage;

    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env);
        this.sql = ctx.storage.sql;
        
        // Drop the existing table and create new one with receiver_emails column
        // this.sql.exec(`DROP TABLE IF EXISTS credentials;`);

        this.sql.exec(`CREATE TABLE IF NOT EXISTS credentials(
            location_id TEXT PRIMARY KEY,
            company_id TEXT,
            access_token TEXT,
            refresh_token TEXT,
            expires_at TIMESTAMP,
            receiver_emails TEXT DEFAULT '[]'
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

                // Convert receiver_emails back to array
                const processedResult = {
                    ...result,
                    receiverEmails: this.jsonToArray(result.receiver_emails as string)
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

                // Process all results to convert receiver_emails
                const processedData = data.map(result => ({
                    ...result,
                    receiverEmails: this.jsonToArray(result.receiver_emails as string)
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
        receiver_emails?: string[]; // Optional for backward compatibility
    }) {
        const { location_id, company_id, access_token, refresh_token, expires_at, receiver_emails = [] } = credential;

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
            const receiver_emails_json = this.arrayToJson(receiver_emails);

            // Insert new credential with receiverEmails
            const result = this.sql.exec(`
                INSERT OR REPLACE INTO credentials (location_id, company_id, access_token, refresh_token, expires_at, receiver_emails) 
                VALUES (?, ?, ?, ?, ?, ?)
            `, location_id, company_id, access_token, refresh_token, expires_at, receiver_emails_json);
            
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
                "UPDATE credentials SET receiver_emails = ? WHERE location_id = ?", 
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

    /**
     * Updates only the token pair (access_token, refresh_token, expires_at) for a location
     * @param locationId - The location ID to update
     * @param newAccessToken - The new access token
     * @param newRefreshToken - The new refresh token
     * @param expiresAt - The new expiration date
     * @returns Success result with status information
     */
    async updateTokenPair(locationId: string, newAccessToken: string, newRefreshToken: string, expiresAt: string) {
        try {
            if (!locationId || !newAccessToken || !newRefreshToken || !expiresAt) {
                return {
                    success: false,
                    message: 'Missing required parameters: locationId, newAccessToken, newRefreshToken, or expiresAt'
                };
            }

            // Check if credential exists
            const existing = this.sql.exec("SELECT 1 FROM credentials WHERE location_id = ?", locationId);
            if (!existing.one()) {
                return {
                    success: false,
                    message: `Credential with location_id '${locationId}' not found`
                };
            }

            // Update only the token-related fields
            this.sql.exec(`
                UPDATE credentials 
                SET access_token = ?, refresh_token = ?, expires_at = ? 
                WHERE location_id = ?
            `, newAccessToken, newRefreshToken, expiresAt, locationId);

            console.log(`Successfully updated token pair for location_id: ${locationId}`);
            console.log(`New Access Token: ${newAccessToken?.slice(0, 10) ?? 'None'}...`);
            console.log(`New Refresh Token: ${newRefreshToken?.slice(0, 10) ?? 'None'}...`);
            console.log(`New Expires At: ${expiresAt}`);

            return {
                success: true,
                message: 'Token pair updated successfully',
                data: {
                    location_id: locationId,
                    expires_at: expiresAt
                }
            };

        } catch (error) {
            console.error('Error updating token pair:', error);
            return {
                success: false,
                message: `Failed to update token pair: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}

