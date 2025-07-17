/**
 * Example demonstrating how to use the Email Service
 * This file shows various ways to build and send emails using the modular email service
 */

import { 
    createEmailRequestBuilder, 
    createEmailSender,
    SendEmailRequest,
    BulkEmailResult
} from './index';

// Example 1: Basic email sending
export async function basicEmailExample(resendApiKey: string): Promise<BulkEmailResult> {
    console.log('=== Basic Email Example ===');
    
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

// Example 2: Adding emails one by one
export async function addEmailsOneByOneExample(resendApiKey: string): Promise<BulkEmailResult> {
    console.log('=== Add Emails One By One Example ===');
    
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

// Example 3: Dynamic email content based on user data
export async function dynamicContentExample(
    resendApiKey: string, 
    userData: { name: string; email: string; stockSymbol: string; alertThreshold: number }[]
): Promise<BulkEmailResult> {
    console.log('=== Dynamic Content Example ===');
    
    const receiverEmails = userData.map(user => user.email);
    
    // Create personalized content (in real scenario, you might want to send individual emails)
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

// Example 4: Error handling demonstration
export async function errorHandlingExample(resendApiKey: string): Promise<BulkEmailResult> {
    console.log('=== Error Handling Example ===');
    
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
        console.log(`\nEmail Results:`);
        console.log(`✅ Successfully sent: ${result.totalSent}`);
        console.log(`❌ Failed to send: ${result.totalFailed}`);
        
        console.log(`\nDetailed Results:`);
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

// Example 5: Validation error demonstration
export function validationExample(): void {
    console.log('=== Validation Example ===');
    
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

// Demo function to run all examples
export async function runAllExamples(resendApiKey: string): Promise<void> {
    console.log('🚀 Starting Email Service Demo\n');

    // Only run validation example (no API calls needed)
    validationExample();
    
    console.log('\n📧 Email Service Demo Complete!');
    console.log('\nTo run the actual email sending examples, uncomment the lines below and ensure you have:');
    console.log('1. A valid Resend API key');
    console.log('2. A verified domain in Resend');
    console.log('3. Valid recipient email addresses');
    
    // Uncomment these lines to run actual email sending (requires valid API key and setup)
    /*
    try {
        await basicEmailExample(resendApiKey);
        await addEmailsOneByOneExample(resendApiKey);
        
        const mockUserData = [
            { name: 'John Doe', email: 'john@example.com', stockSymbol: 'AAPL', alertThreshold: 5 },
            { name: 'Jane Smith', email: 'jane@example.com', stockSymbol: 'GOOGL', alertThreshold: 3 }
        ];
        await dynamicContentExample(resendApiKey, mockUserData);
        
        await errorHandlingExample(resendApiKey);
        
        console.log('\n✅ All email examples completed successfully!');
    } catch (error) {
        console.error('❌ Error running examples:', error);
    }
    */
}

// Export a simple usage example for quick reference
export const USAGE_EXAMPLE = `
// Basic Usage:
import { createEmailRequestBuilder, createEmailSender } from './services/email-service';

const emailRequest = createEmailRequestBuilder()
    .setSenderEmail('noreply@yourdomain.com')
    .setReceiverEmails(['user@example.com'])
    .setSubject('Hello World')
    .setHtmlContent('<h1>Hello from Stock Monitoring!</h1>')
    .setResendApiKey(env.RESEND_API_KEY)
    .build();

const emailSender = createEmailSender();
const result = await emailSender.sendBulkEmail(emailRequest);
`;

// Note: This example file is designed to work in a Cloudflare Workers environment
// To test locally, you would need to set up a proper Node.js environment
