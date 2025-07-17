/**
 * Simple integration test to verify all modules work together
 * Run this to ensure the refactoring was successful
 */

import { 
    createEmailRequestBuilder, 
    createEmailSender,
    SendEmailRequest,
    BulkEmailResult 
} from './index';

export function testEmailServiceIntegration(): boolean {
    console.log('🧪 Testing Email Service Integration...');
    
    try {
        // Test 1: Builder pattern works
        console.log('  ✓ Testing builder pattern...');
        const emailRequest: SendEmailRequest = createEmailRequestBuilder()
            .setSenderEmail('test@example.com')
            .addReceiverEmail('recipient1@example.com')
            .addReceiverEmail('recipient2@example.com')
            .setSubject('Test Subject')
            .setHtmlContent('<p>Test Content</p>')
            .setResendApiKey('test-api-key')
            .build();
        
        console.log('  ✓ Email request built successfully');
        console.log(`  ✓ Sender: ${emailRequest.senderEmail}`);
        console.log(`  ✓ Recipients: ${emailRequest.receiverEmails.length}`);
        console.log(`  ✓ Subject: ${emailRequest.subject}`);
        
        // Test 2: Email sender creation works
        console.log('  ✓ Testing email sender creation...');
        const emailSender = createEmailSender();
        console.log('  ✓ Email sender created successfully');
        
        // Test 3: Validation works
        console.log('  ✓ Testing validation...');
        try {
            createEmailRequestBuilder()
                .setSenderEmail('test@example.com')
                // Missing required fields
                .build();
            console.log('  ❌ Validation should have failed');
            return false;
        } catch (error) {
            console.log('  ✓ Validation working correctly');
        }
        
        console.log('✅ All integration tests passed!');
        return true;
        
    } catch (error) {
        console.error('❌ Integration test failed:', error);
        return false;
    }
}

// Export for use in other files
export default testEmailServiceIntegration;
