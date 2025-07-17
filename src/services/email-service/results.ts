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

// Builder pattern for EmailSendResult
export class EmailSendResultBuilder {
    private result: Partial<EmailSendResult> = {};

    setEmail(email: string): EmailSendResultBuilder {
        this.result.email = email;
        return this;
    }

    setSuccess(success: boolean): EmailSendResultBuilder {
        this.result.success = success;
        return this;
    }

    setMessageId(messageId: string): EmailSendResultBuilder {
        this.result.messageId = messageId;
        return this;
    }

    setError(error: string): EmailSendResultBuilder {
        this.result.error = error;
        return this;
    }

    build(): EmailSendResult {
        if (!this.result.email) {
            throw new Error('Email is required for EmailSendResult');
        }
        if (this.result.success === undefined) {
            throw new Error('Success status is required for EmailSendResult');
        }

        return this.result as EmailSendResult;
    }
}

// Builder pattern for BulkEmailResult
export class BulkEmailResultBuilder {
    private result: Partial<BulkEmailResult> = { results: [] };

    setTotalSent(totalSent: number): BulkEmailResultBuilder {
        this.result.totalSent = totalSent;
        return this;
    }

    setTotalFailed(totalFailed: number): BulkEmailResultBuilder {
        this.result.totalFailed = totalFailed;
        return this;
    }

    setResults(results: EmailSendResult[]): BulkEmailResultBuilder {
        this.result.results = results;
        return this;
    }

    addResult(result: EmailSendResult): BulkEmailResultBuilder {
        if (!this.result.results) {
            this.result.results = [];
        }
        this.result.results.push(result);
        return this;
    }

    build(): BulkEmailResult {
        if (!this.result.results) {
            this.result.results = [];
        }
        
        // Auto-calculate totals if not set
        if (this.result.totalSent === undefined) {
            this.result.totalSent = this.result.results.filter(r => r.success).length;
        }
        if (this.result.totalFailed === undefined) {
            this.result.totalFailed = this.result.results.filter(r => !r.success).length;
        }

        return this.result as BulkEmailResult;
    }
}

// Utility functions to create builders
export function createEmailSendResultBuilder(): EmailSendResultBuilder {
    return new EmailSendResultBuilder();
}

export function createBulkEmailResultBuilder(): BulkEmailResultBuilder {
    return new BulkEmailResultBuilder();
}

// Utility function to create a success result
export function createSuccessResult(email: string, messageId?: string): EmailSendResult {
    return createEmailSendResultBuilder()
        .setEmail(email)
        .setSuccess(true)
        .setMessageId(messageId || '')
        .build();
}

// Utility function to create an error result
export function createErrorResult(email: string, error: string): EmailSendResult {
    return createEmailSendResultBuilder()
        .setEmail(email)
        .setSuccess(false)
        .setError(error)
        .build();
}
