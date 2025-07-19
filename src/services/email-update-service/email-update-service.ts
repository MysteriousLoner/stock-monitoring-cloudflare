/**
 * Email Update Service
 * Handles updating receiver email lists for locations with password protection
 */

export interface UpdateEmailRequest {
    locationId: string;
    appPassword: string;
    emailList: string[];
}

export interface UpdateEmailResponse {
    status: 'SUCCESS' | 'ERROR';
    message: string;
    data?: {
        location_id: string;
        emailList: string[];
    };
    errorCode?: string;
}

export class EmailUpdateService {
    private credentialsStub: any;
    private expectedPassword: string;

    constructor(credentialsStub: any, expectedPassword: string) {
        this.credentialsStub = credentialsStub;
        this.expectedPassword = expectedPassword;
    }

    /**
     * Update receiver emails for a location (PUBLIC METHOD)
     * 
     * @param request - Update email request with locationId, appPassword, and emailList
     * @returns Promise<UpdateEmailResponse> - Success or error response
     * @throws Error if validation fails or database operation fails
     */
    async updateReceiverEmails(request: UpdateEmailRequest): Promise<UpdateEmailResponse> {
        try {
            // Validate required fields
            const { locationId, appPassword, emailList } = request;

            if (!locationId) {
                return {
                    status: 'ERROR',
                    errorCode: 'MISSING_LOCATION_ID',
                    message: 'Missing required parameter: locationId'
                };
            }

            if (!appPassword) {
                return {
                    status: 'ERROR',
                    errorCode: 'MISSING_PASSWORD',
                    message: 'Missing required parameter: appPassword'
                };
            }

            if (!Array.isArray(emailList)) {
                return {
                    status: 'ERROR',
                    errorCode: 'INVALID_EMAIL_LIST',
                    message: 'emailList must be an array of strings'
                };
            }

            // Validate password
            if (appPassword !== this.expectedPassword) {
                console.warn(`Invalid password attempt for location_id: ${locationId}`);
                return {
                    status: 'ERROR',
                    errorCode: 'INVALID_PASSWORD',
                    message: 'Invalid application password'
                };
            }

            // Validate email format (basic validation)
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const invalidEmails = emailList.filter(email => !emailRegex.test(email));
            
            if (invalidEmails.length > 0) {
                return {
                    status: 'ERROR',
                    errorCode: 'INVALID_EMAIL_FORMAT',
                    message: `Invalid email format: ${invalidEmails.join(', ')}`
                };
            }

            console.log(`Updating receiver emails for location_id: ${locationId}`);
            console.log(`Email list: ${emailList.join(', ')}`);

            // Call durable object to update receiver emails
            const result = await this.credentialsStub.updateReceiverEmails(locationId, emailList);

            if (result.status === 'SUCCESS') {
                return {
                    status: 'SUCCESS',
                    message: `Successfully updated receiver emails for location ${locationId}`,
                    data: {
                        location_id: locationId,
                        emailList: emailList
                    }
                };
            } else {
                return {
                    status: 'ERROR',
                    errorCode: result.errorCode || 'DATABASE_ERROR',
                    message: result.message || 'Failed to update receiver emails'
                };
            }

        } catch (error) {
            console.error('Error in updateReceiverEmails:', error);
            return {
                status: 'ERROR',
                errorCode: 'INTERNAL_ERROR',
                message: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}

/**
 * Factory function to create an EmailUpdateService instance
 */
export function createEmailUpdateService(
    credentialsStub: any,
    expectedPassword: string
): EmailUpdateService {
    return new EmailUpdateService(credentialsStub, expectedPassword);
}
