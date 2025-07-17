import { Resend } from "resend";

// Email send request object
export interface SendEmailRequest {
    senderEmail: string;
    receiverEmails: string[];
    subject: string;
    htmlContent: string;
    resendApiKey: string;
}

// Email send result for individual emails
export interface EmailSendResult {
    email: string;
    success: boolean;
    messageId?: string;
    error?: string;
}

// Overall send results
export interface BulkEmailResult {
    totalSent: number;
    totalFailed: number;
    results: EmailSendResult[];
}

// Builder pattern for SendEmailRequest
export class SendEmailRequestBuilder {
    private request: Partial<SendEmailRequest> = {};

    setSenderEmail(senderEmail: string): SendEmailRequestBuilder {
        this.request.senderEmail = senderEmail;
        return this;
    }

    setReceiverEmails(receiverEmails: string[]): SendEmailRequestBuilder {
        this.request.receiverEmails = receiverEmails;
        return this;
    }

    addReceiverEmail(email: string): SendEmailRequestBuilder {
        if (!this.request.receiverEmails) {
            this.request.receiverEmails = [];
        }
        this.request.receiverEmails.push(email);
        return this;
    }

    setSubject(subject: string): SendEmailRequestBuilder {
        this.request.subject = subject;
        return this;
    }

    setHtmlContent(htmlContent: string): SendEmailRequestBuilder {
        this.request.htmlContent = htmlContent;
        return this;
    }

    setResendApiKey(resendApiKey: string): SendEmailRequestBuilder {
        this.request.resendApiKey = resendApiKey;
        return this;
    }

    build(): SendEmailRequest {
        // Validate required fields
        if (!this.request.senderEmail) {
            throw new Error('Sender email is required');
        }
        if (!this.request.receiverEmails || this.request.receiverEmails.length === 0) {
            throw new Error('At least one receiver email is required');
        }
        if (!this.request.subject) {
            throw new Error('Subject is required');
        }
        if (!this.request.htmlContent) {
            throw new Error('HTML content is required');
        }
        if (!this.request.resendApiKey) {
            throw new Error('Resend API key is required');
        }

        return this.request as SendEmailRequest;
    }
}

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
                return {
                    email: receiverEmail,
                    success: false,
                    error: JSON.stringify(error)
                };
            }

            console.log(`Successfully sent email to ${receiverEmail}, message ID: ${data?.id}`);
            return {
                email: receiverEmail,
                success: true,
                messageId: data?.id
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.warn(`Exception while sending email to ${receiverEmail}:`, errorMessage);
            
            return {
                email: receiverEmail,
                success: false,
                error: errorMessage
            };
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

        const totalSent = results.filter(r => r.success).length;
        const totalFailed = results.filter(r => !r.success).length;

        console.log(`Bulk email send completed. Sent: ${totalSent}, Failed: ${totalFailed}`);

        return {
            totalSent,
            totalFailed,
            results
        };
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
        const totalSent = results.filter(r => r.success).length;
        const totalFailed = results.filter(r => !r.success).length;

        console.log(`Parallel bulk email send completed. Sent: ${totalSent}, Failed: ${totalFailed}`);

        return {
            totalSent,
            totalFailed,
            results
        };
    }
}

// Factory function to create EmailSender (no longer needs API key)
export function createEmailSender(): EmailSender {
    return new EmailSender();
}

// Utility function to create a new builder
export function createEmailRequestBuilder(): SendEmailRequestBuilder {
    return new SendEmailRequestBuilder();
}