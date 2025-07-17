/**
 * Inventory Query Service
 * Handles inventory queries with automatic token management and filtering
 */

import { createTokenValidator } from '../../utils/token-management/token-validator';
import {
    InventoryQueryRequest,
    InventoryQueryResult,
    InventoryItem,
    InventoryCredentials,
    createInventoryQueryResultBuilder
} from './types';

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
     * Query inventory for a location with automatic token management
     * @param request - The inventory query request
     * @returns InventoryQueryResult with items and metadata
     */
    async queryInventory(request: InventoryQueryRequest): Promise<InventoryQueryResult> {
        const resultBuilder = createInventoryQueryResultBuilder()
            .setLocationId(request.locationId);

        try {
            // Step 1: Get and validate credentials with automatic token refresh
            const credentials = await this.getValidCredentials(request.locationId);
            if (!credentials) {
                return resultBuilder
                    .setError('Failed to obtain valid credentials')
                    .build();
            }

            // Step 2: Get total count of items
            const totalCount = await this.getTotalItemCount(credentials, request.locationId);
            if (totalCount === null) {
                return resultBuilder
                    .setError('Failed to get total item count')
                    .build();
            }

            resultBuilder.setTotalCount(totalCount);

            if (totalCount === 0) {
                return resultBuilder
                    .setMessage('No inventory items found for this location')
                    .build();
            }

            // Step 3: Fetch all items with the actual count
            const allItems = await this.fetchAllItems(credentials, request.locationId, totalCount);
            if (!allItems) {
                return resultBuilder
                    .setError('Failed to fetch inventory items')
                    .build();
            }

            // Step 4: Apply filters if any
            const filteredItems = this.applyFilters(allItems, request.filters || {});

            // Step 5: Apply pagination
            const paginatedItems = this.applyPagination(filteredItems, request.limit || 100, request.offset || 0);

            return resultBuilder
                .setItems(paginatedItems)
                .setTotalCount(totalCount)
                .setMessage(`Successfully retrieved ${paginatedItems.length} items`)
                .build();

        } catch (error) {
            console.error('Error in queryInventory:', error);
            return resultBuilder
                .setError(`Inventory query failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
                .build();
        }
    }

    /**
     * Get valid credentials with automatic token refresh
     */
    private async getValidCredentials(locationId: string): Promise<InventoryCredentials | null> {
        try {
            // Create token validator
            const tokenValidator = createTokenValidator(
                this.credentialsStub,
                this.clientId,
                this.clientSecret
            );

            // Ensure we have a valid token (will refresh if needed)
            const validAccessToken = await tokenValidator.ensureValidToken(locationId);

            // Get the updated credentials
            const credentialsResult = await this.credentialsStub.getCredentials(locationId);
            
            if (credentialsResult.httpCode !== 200 || !credentialsResult.data) {
                throw new Error('Failed to retrieve credentials after token validation');
            }

            return {
                accessToken: validAccessToken,
                locationId: credentialsResult.data.location_id,
                companyId: credentialsResult.data.company_id,
                receiverEmails: credentialsResult.data.receiverEmails || [],
                expiresAt: credentialsResult.data.expires_at
            };

        } catch (error) {
            console.error('Error getting valid credentials:', error);
            return null;
        }
    }

    /**
     * Get total count of inventory items
     */
    private async getTotalItemCount(credentials: InventoryCredentials, locationId: string): Promise<number | null> {
        try {
            const countParams = new URLSearchParams({
                limit: "0",
                altId: locationId,
                altType: "location"
            });

            const headers = {
                'Accept': 'application/json',
                'Authorization': `Bearer ${credentials.accessToken}`,
                'Version': '2021-07-28'
            };

            const countResponse = await fetch(`${this.baseUrl}?${countParams}`, { headers });

            if (!countResponse.ok) {
                const errorText = await countResponse.text();
                throw new Error(`Failed to fetch inventory count: ${countResponse.status} - ${errorText}`);
            }

            const countData = await countResponse.json() as any;
            return countData?.total?.[0]?.total || 0;

        } catch (error) {
            console.error('Error getting total item count:', error);
            return null;
        }
    }

    /**
     * Fetch all inventory items
     */
    private async fetchAllItems(credentials: InventoryCredentials, locationId: string, totalCount: number): Promise<InventoryItem[] | null> {
        try {
            const allParams = new URLSearchParams({
                limit: String(totalCount),
                altId: locationId,
                altType: "location"
            });

            const headers = {
                'Accept': 'application/json',
                'Authorization': `Bearer ${credentials.accessToken}`,
                'Version': '2021-07-28'
            };

            const inventoryResponse = await fetch(`${this.baseUrl}?${allParams}`, { headers });

            if (!inventoryResponse.ok) {
                const errorText = await inventoryResponse.text();
                throw new Error(`Failed to fetch inventory items: ${inventoryResponse.status} - ${errorText}`);
            }

            const inventoryData = await inventoryResponse.json() as any;
            
            // Transform API response to our InventoryItem format
            return this.transformApiItems(inventoryData.inventory || []);

        } catch (error) {
            console.error('Error fetching all items:', error);
            return null;
        }
    }

    /**
     * Transform API response items to our InventoryItem format
     */
    private transformApiItems(apiItems: any[]): InventoryItem[] {
        return apiItems.map(item => ({
            id: item.id || item.productId || '',
            name: item.name || item.title || '',
            sku: item.sku || item.productSku || '',
            category: item.category || '',
            price: item.price ? parseFloat(item.price) : undefined,
            quantity: item.quantity ? parseInt(item.quantity) : undefined,
            lowStockThreshold: item.lowStockThreshold ? parseInt(item.lowStockThreshold) : undefined,
            isLowStock: this.isLowStock(item),
            description: item.description || '',
            images: item.images || [],
            status: item.status || 'active'
        }));
    }

    /**
     * Check if an item is low on stock
     */
    private isLowStock(item: any): boolean {
        const quantity = item.quantity ? parseInt(item.quantity) : 0;
        const threshold = item.lowStockThreshold ? parseInt(item.lowStockThreshold) : 5; // Default threshold
        return quantity <= threshold;
    }

    /**
     * Apply filters to inventory items
     */
    private applyFilters(items: InventoryItem[], filters: any): InventoryItem[] {
        let filteredItems = [...items];

        // Filter by low stock
        if (filters.lowStockThreshold !== undefined) {
            filteredItems = filteredItems.filter(item => {
                const quantity = item.quantity || 0;
                return quantity <= filters.lowStockThreshold;
            });
        }

        // Filter by category
        if (filters.category) {
            filteredItems = filteredItems.filter(item => 
                item.category?.toLowerCase().includes(filters.category.toLowerCase())
            );
        }

        // Filter in-stock only
        if (filters.inStockOnly) {
            filteredItems = filteredItems.filter(item => (item.quantity || 0) > 0);
        }

        return filteredItems;
    }

    /**
     * Apply pagination to items
     */
    private applyPagination(items: InventoryItem[], limit: number, offset: number): InventoryItem[] {
        return items.slice(offset, offset + limit);
    }

    /**
     * Filter items that are low on stock
     * @param request - The inventory query request
     * @returns InventoryQueryResult with only low-stock items
     */
    async queryLowStockItems(request: InventoryQueryRequest): Promise<InventoryQueryResult> {
        // Set up filters for low stock items
        const lowStockRequest = {
            ...request,
            filters: {
                ...request.filters,
                lowStockThreshold: request.filters?.lowStockThreshold || 5 // Default threshold
            }
        };

        const result = await this.queryInventory(lowStockRequest);
        
        if (result.success) {
            // Further filter to only include items marked as low stock
            const lowStockItems = result.items.filter(item => item.isLowStock);
            
            return createInventoryQueryResultBuilder()
                .setLocationId(request.locationId)
                .setItems(lowStockItems)
                .setTotalCount(result.totalCount)
                .setMessage(`Found ${lowStockItems.length} low-stock items`)
                .build();
        }

        return result;
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