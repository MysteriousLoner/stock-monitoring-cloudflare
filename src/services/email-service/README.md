# Email Service

A modular email service for Cloudflare Workers using Resend API. This service provides a clean, type-safe way to send emails with proper error handling and logging.

## File Structure

```
src/services/email-service/
├── index.ts           # Main export file (barrel exports)
├── requests.ts        # Email request interfaces and builders
├── results.ts         # Email result interfaces and builders
├── email-sender.ts    # Main email sender service
└── example-call.ts    # Usage examples and demonstrations
```

## Features

- **Type-safe**: Full TypeScript support with proper interfaces
- **Builder Pattern**: Fluent API for building email requests
- **Error Handling**: Comprehensive error handling with detailed logging
- **Bulk Sending**: Support for sending to multiple recipients
- **Parallel/Sequential**: Choose between parallel or sequential sending
- **Modular**: Clean separation of concerns across multiple files

## Quick Start

```typescript
import { createEmailRequestBuilder, createEmailSender } from './services/email-service';

// Build email request
const emailRequest = createEmailRequestBuilder()
    .setSenderEmail('noreply@yourdomain.com')
    .setReceiverEmails(['user1@example.com', 'user2@example.com'])
    .setSubject('Welcome!')
    .setHtmlContent('<h1>Welcome to our service!</h1>')
    .setResendApiKey(env.RESEND_API_KEY)
    .build();

// Send emails
const emailSender = createEmailSender();
const result = await emailSender.sendBulkEmail(emailRequest);

console.log(`Sent: ${result.totalSent}, Failed: ${result.totalFailed}`);
```

## Usage in Your Worker

### Basic Integration

```typescript
// In your route handler
import { createEmailRequestBuilder, createEmailSender } from '../services/email-service';

export async function sendNotificationEmail(request: Request, env: Env): Promise<Response> {
    const body = await request.json();
    
    const emailRequest = createEmailRequestBuilder()
        .setSenderEmail('notifications@yourdomain.com')
        .setReceiverEmails(body.recipients)
        .setSubject(body.subject)
        .setHtmlContent(body.htmlContent)
        .setResendApiKey(env.RESEND_API_KEY)
        .build();
    
    const emailSender = createEmailSender();
    const result = await emailSender.sendBulkEmail(emailRequest);
    
    return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
    });
}
```

### Integration with Durable Objects

```typescript
// Send notification emails when credentials are updated
const emailRequest = createEmailRequestBuilder()
    .setSenderEmail('system@yourdomain.com')
    .setReceiverEmails(credentialData.receiverEmails) // From your DB
    .setSubject('Credential Update Notification')
    .setHtmlContent(`
        <h2>Credential Updated</h2>
        <p>Credentials for location ${credentialData.location_id} have been updated.</p>
        <p>Company: ${credentialData.company_id}</p>
        <p>Time: ${new Date().toISOString()}</p>
    `)
    .setResendApiKey(env.RESEND_API_KEY)
    .build();

const emailSender = createEmailSender();
const emailResult = await emailSender.sendBulkEmail(emailRequest);
```

## API Reference

### Interfaces

- `SendEmailRequest` - Main email request object
- `EmailSendResult` - Result for individual email sends
- `BulkEmailResult` - Result for bulk email operations

### Builders

- `SendEmailRequestBuilder` - Fluent API for building email requests
- `EmailSendResultBuilder` - Builder for individual email results
- `BulkEmailResultBuilder` - Builder for bulk email results

### Services

- `EmailSender` - Main email sending service with bulk and parallel options

## Examples

See `example-call.ts` for comprehensive usage examples including:
- Basic email sending
- Dynamic content generation
- Error handling
- Validation examples
- Bulk operations

## Requirements

- Resend API key
- Verified domain in Resend
- Valid recipient email addresses

## Error Handling

The service provides detailed error handling:
- Individual email failures don't stop bulk operations
- Detailed logging for debugging
- Structured error responses
- Validation of required fields

## Rate Limiting

- Use `sendBulkEmail()` for sequential sending (recommended)
- Use `sendBulkEmailParallel()` for parallel sending (be careful with rate limits)
