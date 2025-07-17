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

### Example 1: Basic Email Sending

```typescript
import { createEmailRequestBuilder, createEmailSender } from './services/email-service';

export async function basicEmailExample(resendApiKey: string): Promise<BulkEmailResult> {
    const emailRequest = createEmailRequestBuilder()
        .setSenderEmail('notifications@yourdomain.com')
        .setReceiverEmails(['user1@example.com', 'user2@example.com'])
        .setSubject('Welcome to Stock Monitoring')
        .setHtmlContent(`
            <h1>Welcome to Stock Monitoring!</h1>
            <p>Thank you for subscribing to our stock monitoring service.</p>
            <p>You will receive notifications when important stock changes occur.</p>
            <br>
            <p>Best regards,<br>The Stock Monitoring Team</p>
        `)
        .setResendApiKey(resendApiKey)
        .build();

    const emailSender = createEmailSender();
    return emailSender.sendBulkEmail(emailRequest);
}
```

### Example 2: Adding Recipients One by One

```typescript
export async function addEmailsOneByOneExample(resendApiKey: string): Promise<BulkEmailResult> {
    const emailRequest = createEmailRequestBuilder()
        .setSenderEmail('alerts@yourdomain.com')
        .addReceiverEmail('admin@company.com')
        .addReceiverEmail('manager@company.com')
        .addReceiverEmail('investor@company.com')
        .setSubject('Stock Alert: Price Change Detected')
        .setHtmlContent(`
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2 style="color: #e74c3c;">🚨 Stock Alert</h2>
                <p>A significant price change has been detected in your monitored stocks:</p>
                
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <h3>Stock Details:</h3>
                    <ul>
                        <li><strong>Symbol:</strong> AAPL</li>
                        <li><strong>Current Price:</strong> $180.25</li>
                        <li><strong>Change:</strong> +5.2% ↗️</li>
                        <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
                    </ul>
                </div>
                
                <p style="color: #7f8c8d; font-size: 12px;">
                    This is an automated notification from your Stock Monitoring System.
                </p>
            </div>
        `)
        .setResendApiKey(resendApiKey)
        .build();

    const emailSender = createEmailSender();
    return emailSender.sendBulkEmailParallel(emailRequest); // Using parallel sending
}
```

### Example 3: Dynamic Content with User Data

```typescript
export async function dynamicContentExample(
    resendApiKey: string, 
    userData: { name: string; email: string; stockSymbol: string; alertThreshold: number }[]
): Promise<BulkEmailResult> {
    const receiverEmails = userData.map(user => user.email);
    
    // Create personalized content
    const personalizedContent = userData.map(user => 
        `<li>${user.name} - Monitoring ${user.stockSymbol} (Alert threshold: ${user.alertThreshold}%)</li>`
    ).join('');

    const emailRequest = createEmailRequestBuilder()
        .setSenderEmail('reports@yourdomain.com')
        .setReceiverEmails(receiverEmails)
        .setSubject('Weekly Stock Monitoring Report')
        .setHtmlContent(`
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <h1 style="color: #2c3e50;">📊 Weekly Stock Report</h1>
                
                <p>Here's your weekly summary of monitored stocks and alerts:</p>
                
                <h3>Active Subscribers:</h3>
                <ul style="background-color: #ecf0f1; padding: 15px; border-radius: 5px;">
                    ${personalizedContent}
                </ul>
                
                <div style="margin-top: 30px; padding: 20px; background-color: #e8f5e8; border-radius: 5px;">
                    <h3 style="color: #27ae60;">📈 This Week's Performance</h3>
                    <p>• Total alerts sent: 23</p>
                    <p>• Most active stock: TSLA (8 alerts)</p>
                    <p>• Average price change: +2.1%</p>
                </div>
                
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #bdc3c7;">
                
                <p style="color: #7f8c8d; font-size: 12px;">
                    Generated on: ${new Date().toLocaleDateString()}<br>
                    To unsubscribe or modify alerts, please contact support.
                </p>
            </div>
        `)
        .setResendApiKey(resendApiKey)
        .build();

    const emailSender = createEmailSender();
    return emailSender.sendBulkEmail(emailRequest);
}
```

### Example 4: Error Handling with Mixed Results

```typescript
export async function errorHandlingExample(resendApiKey: string): Promise<BulkEmailResult> {
    try {
        const emailRequest = createEmailRequestBuilder()
            .setSenderEmail('test@yourdomain.com')
            .setReceiverEmails([
                'valid-email@example.com',
                'invalid-email@nonexistent-domain-xyz.com', // This will likely fail
                'another-valid@example.com'
            ])
            .setSubject('Testing Error Handling')
            .setHtmlContent('<p>This email tests how we handle mixed success/failure scenarios.</p>')
            .setResendApiKey(resendApiKey)
            .build();

        const emailSender = createEmailSender();
        const result = await emailSender.sendBulkEmail(emailRequest);

        // Log results
        console.log(`Email Results:`);
        console.log(`✅ Successfully sent: ${result.totalSent}`);
        console.log(`❌ Failed to send: ${result.totalFailed}`);
        
        console.log(`Detailed Results:`);
        result.results.forEach(emailResult => {
            if (emailResult.success) {
                console.log(`✅ ${emailResult.email} - Message ID: ${emailResult.messageId}`);
            } else {
                console.log(`❌ ${emailResult.email} - Error: ${emailResult.error}`);
            }
        });

        return result;

    } catch (error) {
        console.error('Error in errorHandlingExample:', error);
        throw error;
    }
}
```

### Example 5: Validation and Error Demonstration

```typescript
export function validationExample(): void {
    try {
        // This will throw an error due to missing required fields
        const invalidRequest = createEmailRequestBuilder()
            .setSenderEmail('test@example.com')
            // Missing receiver emails, subject, content, and API key
            .build();
            
        console.log('This should not print - validation should have failed');
    } catch (error) {
        console.log('✅ Validation worked correctly:', (error as Error).message);
    }

    try {
        // This will also throw an error
        const anotherInvalidRequest = createEmailRequestBuilder()
            .setSenderEmail('test@example.com')
            .setSubject('Test Subject')
            .setHtmlContent('<p>Test content</p>')
            .setResendApiKey('test-key')
            // Missing receiver emails
            .build();
            
        console.log('This should not print - validation should have failed');
    } catch (error) {
        console.log('✅ Validation worked correctly:', (error as Error).message);
    }
}
```

### Common Usage Patterns

#### Basic Email Request
```typescript
// Basic email sending
const emailRequest = createEmailRequestBuilder()
    .setSenderEmail('noreply@yourdomain.com')
    .setReceiverEmails(['user@example.com'])
    .setSubject('Hello World')
    .setHtmlContent('<h1>Hello from Stock Monitoring!</h1>')
    .setResendApiKey(env.RESEND_API_KEY)
    .build();

const emailSender = createEmailSender();
const result = await emailSender.sendBulkEmail(emailRequest);
```

#### Sequential vs Parallel Sending
```typescript
// Sequential sending (recommended for rate limiting)
const result = await emailSender.sendBulkEmail(emailRequest);

// Parallel sending (faster but may hit rate limits)
const result = await emailSender.sendBulkEmailParallel(emailRequest);
```

#### Processing Results
```typescript
const result = await emailSender.sendBulkEmail(emailRequest);

console.log(`Total sent: ${result.totalSent}`);
console.log(`Total failed: ${result.totalFailed}`);

// Process individual results
result.results.forEach(emailResult => {
    if (emailResult.success) {
        console.log(`✅ Sent to ${emailResult.email} - ID: ${emailResult.messageId}`);
    } else {
        console.log(`❌ Failed to send to ${emailResult.email}: ${emailResult.error}`);
    }
});
```

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
