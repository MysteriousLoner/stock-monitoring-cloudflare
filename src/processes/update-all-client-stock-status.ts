/**
 * Update All Client Stock Status Process
 * Iterates through all locations and sends stock status emails to configured recipients
 */

import { createInventoryQueryService } from '../services/inventory-query-service';
import { createEmailSender } from '../services/email-service';

export interface UpdateClientStockStatusConfig {
    credentialsStub: any;
    clientId: string;
    clientSecret: string;
    resendApiKey: string;
    senderEmail: string;
}

export interface StockStatusUpdateResult {
    processedLocations: number;
    emailsSent: number;
    errors: Array<{
        locationId: string;
        error: string;
    }>;
    locationsWithoutEmails: number;
    locationsWithoutStock: number;
}

export class UpdateAllClientStockStatus {
    private config: UpdateClientStockStatusConfig;

    constructor(config: UpdateClientStockStatusConfig) {
        this.config = config;
    }

    /**
     * Process all client locations and send stock status updates
     * @returns Promise<StockStatusUpdateResult> - Summary of the update process
     */
    async processAllClients(): Promise<StockStatusUpdateResult> {
        console.log('Starting UpdateAllClientStockStatus process...');
        
        const result: StockStatusUpdateResult = {
            processedLocations: 0,
            emailsSent: 0,
            errors: [],
            locationsWithoutEmails: 0,
            locationsWithoutStock: 0
        };

        try {
            // Get all credentials from the database
            const credentialsResponse = await this.config.credentialsStub.getCredentials();
            
            if (credentialsResponse.status !== 'SUCCESS' || !credentialsResponse.data) {
                throw new Error(`Failed to retrieve credentials: ${credentialsResponse.message}`);
            }

            const credentials = Array.isArray(credentialsResponse.data) ? credentialsResponse.data : [credentialsResponse.data];
            console.log(`Found ${credentials.length} locations to process`);

            // Create services
            const inventoryService = createInventoryQueryService(
                this.config.credentialsStub,
                this.config.clientId,
                this.config.clientSecret
            );
            const emailSender = createEmailSender();

            // Process each location
            for (const credential of credentials) {
                result.processedLocations++;
                console.log(`Processing location: ${credential.location_id}`);

                try {
                    // Check if location has receiver emails configured
                    const receiverEmails = credential.receiverEmails || [];
                    if (!receiverEmails || receiverEmails.length === 0) {
                        console.log(`Skipping location ${credential.location_id} - no receiver emails configured`);
                        result.locationsWithoutEmails++;
                        continue;
                    }

                    // Get inventory summary for this location
                    const inventorySummary = await inventoryService.queryInventorySummary(credential.location_id);
                    
                    // Check if there are items out of stock
                    if (inventorySummary.items_out_of_stock === 0) {
                        console.log(`Location ${credential.location_id} has no out-of-stock items`);
                        result.locationsWithoutStock++;
                        continue;
                    }

                    console.log(`Location ${credential.location_id} has ${inventorySummary.items_out_of_stock} items out of stock`);

                    // Generate HTML email content
                    const htmlContent = this.generateStockStatusEmail(inventorySummary);

                    // Send email to all configured recipients
                    const emailResult = await emailSender.sendBulkEmail({
                        senderEmail: this.config.senderEmail,
                        receiverEmails: receiverEmails,
                        subject: `Stock Alert: ${inventorySummary.items_out_of_stock} items out of stock (Location: ${credential.location_id})`,
                        htmlContent: htmlContent,
                        resendApiKey: this.config.resendApiKey
                    });

                    result.emailsSent += emailResult.totalSent;
                    console.log(`Sent stock alert emails to ${emailResult.totalSent} recipients for location ${credential.location_id}`);

                    // Log any email failures
                    if (emailResult.totalFailed > 0) {
                        console.warn(`Failed to send ${emailResult.totalFailed} emails for location ${credential.location_id}`);
                    }

                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    console.error(`Error processing location ${credential.location_id}:`, errorMessage);
                    result.errors.push({
                        locationId: credential.location_id,
                        error: errorMessage
                    });
                }
            }

            console.log('UpdateAllClientStockStatus process completed');
            console.log(`Summary: Processed ${result.processedLocations} locations, sent ${result.emailsSent} emails, ${result.errors.length} errors`);

            return result;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error in UpdateAllClientStockStatus process:', errorMessage);
            throw new Error(`Process failed: ${errorMessage}`);
        }
    }

    /**
     * Generate HTML content for stock status email
     * @param inventorySummary - The inventory summary data
     * @returns string - Formatted HTML email content
     */
    private generateStockStatusEmail(inventorySummary: any): string {
        const outOfStockList = inventorySummary.out_of_stock_products
            .map((product: string) => `<li style="margin: 5px 0;">${product}</li>`)
            .join('');

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Stock Status Alert</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f44336; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
        .summary-box { background-color: white; padding: 15px; margin: 20px 0; border-left: 4px solid #f44336; }
        .stats { display: flex; justify-content: space-between; margin: 20px 0; }
        .stat { text-align: center; }
        .stat-number { font-size: 24px; font-weight: bold; color: #f44336; }
        .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .out-of-stock-list { background-color: white; padding: 15px; margin: 20px 0; border-radius: 5px; }
        ul { margin: 10px 0; padding-left: 20px; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📦 Stock Status Alert</h1>
            <p>Items require restocking attention</p>
        </div>
        
        <div class="content">
            <div class="summary-box">
                <h2>📍 Location: ${inventorySummary.location_id}</h2>
                <p><strong>Alert:</strong> You have items that are currently out of stock and may need restocking.</p>
            </div>

            <div class="stats">
                <div class="stat">
                    <div class="stat-number">${inventorySummary.total_items}</div>
                    <div class="stat-label">Total Items</div>
                </div>
                <div class="stat">
                    <div class="stat-number">${inventorySummary.items_with_stock}</div>
                    <div class="stat-label">In Stock</div>
                </div>
                <div class="stat">
                    <div class="stat-number">${inventorySummary.items_out_of_stock}</div>
                    <div class="stat-label">Out of Stock</div>
                </div>
                <div class="stat">
                    <div class="stat-number">${inventorySummary.total_available_quantity}</div>
                    <div class="stat-label">Total Quantity</div>
                </div>
            </div>

            <div class="out-of-stock-list">
                <h3>🚨 Out of Stock Items (${inventorySummary.items_out_of_stock} items):</h3>
                <ul>
                    ${outOfStockList}
                </ul>
            </div>

            <div class="summary-box">
                <p><strong>📊 Summary:</strong></p>
                <ul>
                    <li>Total unique products: ${inventorySummary.unique_products}</li>
                    <li>Items with stock: ${inventorySummary.items_with_stock}</li>
                    <li>Items out of stock: ${inventorySummary.items_out_of_stock}</li>
                    <li>Total available quantity: ${inventorySummary.total_available_quantity}</li>
                </ul>
            </div>
        </div>

        <div class="footer">
            <p>This is an automated stock monitoring alert. Please review and restock items as needed.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>
        `.trim();
    }
}

/**
 * Factory function to create UpdateAllClientStockStatus instance
 */
export function createUpdateAllClientStockStatus(config: UpdateClientStockStatusConfig): UpdateAllClientStockStatus {
    return new UpdateAllClientStockStatus(config);
}