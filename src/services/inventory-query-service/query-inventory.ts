/**
 * Inventory Query Service
 * Handles inventory queries with automatic token management
 * Simplified interface based on Python implementation
 */

import { createTokenValidator } from '../../utils/token-management/token-validator';

// Simplified interfaces for the new implementation
export interface InventoryItem {
    product?: string;
    availableQuantity?: number;
    [key: string]: any; // Allow other properties from API
}

export interface InventoryResponse {
    inventory: InventoryItem[];
    total: Array<{ total: number }>;
    traceId?: string;
}

export interface InventorySummary {
    location_id: string;
    total_items: number;
    total_available_quantity: number;
    unique_products: number;
    items_with_stock: number;
    items_out_of_stock: number;
}

export class InventoryQueryService {
    private credentialsStub: any;
    private clientId: string;
    private clientSecret: string;
    private baseUrl: string = "https://services.leadconnectorhq.com/products/inventory";

    constructor(credentialsStub: any, clientId: string, clientSecret: string) {
        this.credentialsStub = credentialsStub;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    /**
     * Get a summary of inventory for a location (PUBLIC METHOD)
     * 
     * @param locationId - The location ID to get summary for
     * @returns Promise<InventorySummary> - Summary information about the inventory
     * @throws Error if locationId is missing or API requests fail
     */
    async queryInventorySummary(locationId: string): Promise<InventorySummary> {
        if (!locationId) {
            const errorMsg = "Missing required parameter: location_id";
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        try {
            console.log(`Getting inventory summary for location_id: ${locationId}`);
            
            // Get full inventory data
            const inventoryData = await this.getInventory(locationId);
            
            const items = inventoryData.inventory || [];
            const totalCount = inventoryData.total?.[0]?.total || 0;
            
            // Calculate summary statistics
            const totalAvailable = items.reduce((sum, item) => sum + (item.availableQuantity || 0), 0);
            const uniqueProducts = new Set(
                items
                    .map(item => item.product)
                    .filter(product => product)
            ).size;
            
            const itemsWithStock = items.filter(item => (item.availableQuantity || 0) > 0).length;
            const itemsOutOfStock = items.filter(item => (item.availableQuantity || 0) === 0).length;
            
            const summary: InventorySummary = {
                location_id: locationId,
                total_items: totalCount,
                total_available_quantity: totalAvailable,
                unique_products: uniqueProducts,
                items_with_stock: itemsWithStock,
                items_out_of_stock: itemsOutOfStock
            };
            
            console.log(`Generated inventory summary for location_id: ${locationId}`);
            return summary;
            
        } catch (error) {
            const errorMsg = `Error generating inventory summary: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
    }

    /**
     * Get all inventory items for a location (PRIVATE METHOD)
     * 
     * @param locationId - The location ID to get inventory for
     * @returns Promise<InventoryResponse> - Complete inventory response with all items
     * @throws Error if API requests fail
     */
    private async getInventory(locationId: string): Promise<InventoryResponse> {
        try {
            // Ensure we have a valid access token
            const accessToken = await this.ensureValidToken(locationId);
            
            // Common headers
            const headers = {
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'Version': '2021-07-28'
            };
            
            // Step 1: Get total count
            console.log(`Getting total inventory count for location_id: ${locationId}`);
            
            const countParams = new URLSearchParams({
                limit: "0",
                altId: locationId,
                altType: "location"
            });
            
            const countResponse = await fetch(`${this.baseUrl}?${countParams}`, { headers });
            
            if (!countResponse.ok) {
                const errorText = await countResponse.text();
                throw new Error(`API request failed: ${countResponse.status} - ${errorText}`);
            }
            
            const countData = await countResponse.json() as any;
            
            // Extract total count
            let totalItems = 0;
            if (countData.total && countData.total.length > 0) {
                totalItems = countData.total[0].total || 0;
            }
            
            console.log(`Found ${totalItems} total items for location_id: ${locationId}`);
            
            if (totalItems === 0) {
                return {
                    inventory: [],
                    total: [{ total: 0 }],
                    traceId: countData.traceId || ''
                };
            }
            
            // Step 2: Get all items
            console.log(`Fetching all ${totalItems} inventory items for location_id: ${locationId}`);
            
            const allParams = new URLSearchParams({
                limit: String(totalItems),
                altId: locationId,
                altType: "location"
            });
            
            const inventoryResponse = await fetch(`${this.baseUrl}?${allParams}`, { headers });
            
            if (!inventoryResponse.ok) {
                const errorText = await inventoryResponse.text();
                throw new Error(`API request failed: ${inventoryResponse.status} - ${errorText}`);
            }
            
            const inventoryData = await inventoryResponse.json() as any;
            
            console.log(`Successfully retrieved ${inventoryData.inventory?.length || 0} items for location_id: ${locationId}`);
            
            return inventoryData;
            
        } catch (error) {
            if (error instanceof Error) {
                console.error(`API request failed: ${error.message}`);
                throw new Error(`API request failed: ${error.message}`);
            } else {
                const errorMsg = `Unexpected error getting inventory: ${String(error)}`;
                console.error(errorMsg);
                throw new Error(errorMsg);
            }
        }
    }

    /**
     * Ensure we have a valid access token with automatic refresh
     */
    private async ensureValidToken(locationId: string): Promise<string> {
        try {
            // Create token validator
            const tokenValidator = createTokenValidator(
                this.credentialsStub,
                this.clientId,
                this.clientSecret
            );

            // Ensure we have a valid token (will refresh if needed)
            return await tokenValidator.ensureValidToken(locationId);

        } catch (error) {
            console.error('Error ensuring valid token:', error);
            throw new Error(`Failed to obtain valid credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

/**
 * Factory function to create an InventoryQueryService instance
 */
export function createInventoryQueryService(
    credentialsStub: any,
    clientId: string,
    clientSecret: string
): InventoryQueryService {
    return new InventoryQueryService(credentialsStub, clientId, clientSecret);
}