// Email send request object
export interface SendEmailRequest {
    senderEmail: string;
    receiverEmails: string[];
    subject: string;
    htmlContent: string;
    resendApiKey: string;
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

// Utility function to create a new builder
export function createEmailRequestBuilder(): SendEmailRequestBuilder {
    return new SendEmailRequestBuilder();
}
