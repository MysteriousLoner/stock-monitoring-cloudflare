import { Resend } from "resend";
import { SendEmailRequest } from "./requests";
import { 
    EmailSendResult, 
    BulkEmailResult, 
    createSuccessResult, 
    createErrorResult,
    createBulkEmailResultBuilder 
} from "./results";

// Email sender service - Updated to use API key from request
export class EmailSender {
    // Remove constructor dependency on API key
    constructor() {
        // No longer need API key in constructor
    }

    // Send email to a single recipient
    private async sendSingleEmail(
        senderEmail: string,
        receiverEmail: string,
        subject: string,
        htmlContent: string,
        resendApiKey: string
    ): Promise<EmailSendResult> {
        try {
            console.log(`Attempting to send email to: ${receiverEmail}`);
            
            // Create Resend instance with the provided API key
            const resend = new Resend(resendApiKey);
            
            const { data, error } = await resend.emails.send({
                from: senderEmail,
                to: receiverEmail,
                subject: subject,
                html: htmlContent,
            });

            if (error) {
                console.warn(`Failed to send email to ${receiverEmail}:`, error);
                return createErrorResult(receiverEmail, JSON.stringify(error));
            }

            console.log(`Successfully sent email to ${receiverEmail}, message ID: ${data?.id}`);
            return createSuccessResult(receiverEmail, data?.id);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.warn(`Exception while sending email to ${receiverEmail}:`, errorMessage);
            
            return createErrorResult(receiverEmail, errorMessage);
        }
    }

    // Send emails to multiple recipients
    async sendBulkEmail(emailRequest: SendEmailRequest): Promise<BulkEmailResult> {
        console.log(`Starting bulk email send to ${emailRequest.receiverEmails.length} recipients`);
        
        const results: EmailSendResult[] = [];

        // Send emails sequentially to avoid rate limiting
        for (const receiverEmail of emailRequest.receiverEmails) {
            const result = await this.sendSingleEmail(
                emailRequest.senderEmail,
                receiverEmail,
                emailRequest.subject,
                emailRequest.htmlContent,
                emailRequest.resendApiKey
            );
            results.push(result);
        }

        const bulkResult = createBulkEmailResultBuilder()
            .setResults(results)
            .build();

        console.log(`Bulk email send completed. Sent: ${bulkResult.totalSent}, Failed: ${bulkResult.totalFailed}`);

        return bulkResult;
    }

    // Send emails in parallel (use with caution due to rate limits)
    async sendBulkEmailParallel(emailRequest: SendEmailRequest): Promise<BulkEmailResult> {
        console.log(`Starting parallel bulk email send to ${emailRequest.receiverEmails.length} recipients`);
        
        const emailPromises = emailRequest.receiverEmails.map(receiverEmail =>
            this.sendSingleEmail(
                emailRequest.senderEmail,
                receiverEmail,
                emailRequest.subject,
                emailRequest.htmlContent,
                emailRequest.resendApiKey
            )
        );

        const results = await Promise.all(emailPromises);
        
        const bulkResult = createBulkEmailResultBuilder()
            .setResults(results)
            .build();

        console.log(`Parallel bulk email send completed. Sent: ${bulkResult.totalSent}, Failed: ${bulkResult.totalFailed}`);

        return bulkResult;
    }
}

// Factory function to create EmailSender
export function createEmailSender(): EmailSender {
    return new EmailSender();
}