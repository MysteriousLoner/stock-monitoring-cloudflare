// Export all public interfaces and functions
export * from './requests';
export * from './results';
export * from './email-sender';

// Re-export commonly used items for convenience
export type { 
    SendEmailRequest
} from './requests';

export { 
    createEmailRequestBuilder 
} from './requests';

export type { 
    EmailSendResult,
    BulkEmailResult
} from './results';

export { 
    createSuccessResult,
    createErrorResult
} from './results';

export { 
    EmailSender,
    createEmailSender 
} from './email-sender';
