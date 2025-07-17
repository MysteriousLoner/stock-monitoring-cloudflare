/**
 * Inventory Query Service - Types and Interfaces
 * Handles inventory queries with automatic token management
 */

export interface InventoryQueryRequest {
    locationId: string;
    limit?: number;
    offset?: number;
    filters?: InventoryFilters;
}

export interface InventoryFilters {
    lowStockThreshold?: number;
    category?: string;
    inStockOnly?: boolean;
}

export interface InventoryItem {
    id: string;
    name: string;
    sku?: string;
    category?: string;
    price?: number;
    quantity?: number;
    lowStockThreshold?: number;
    isLowStock?: boolean;
    description?: string;
    images?: string[];
    status?: 'active' | 'inactive' | 'draft';
}

export interface InventoryQueryResult {
    success: boolean;
    items: InventoryItem[];
    totalCount: number;
    filteredCount: number;
    locationId: string;
    timestamp: string;
    message?: string;
    error?: string;
}

export interface InventoryCredentials {
    accessToken: string;
    locationId: string;
    companyId: string;
    receiverEmails: string[];
    expiresAt: string;
}

/**
 * Builder for Inventory Query Requests
 */
export class InventoryQueryRequestBuilder {
    private request: Partial<InventoryQueryRequest> = {};

    setLocationId(locationId: string): this {
        this.request.locationId = locationId;
        return this;
    }

    setLimit(limit: number): this {
        this.request.limit = limit;
        return this;
    }

    setOffset(offset: number): this {
        this.request.offset = offset;
        return this;
    }

    setLowStockThreshold(threshold: number): this {
        if (!this.request.filters) {
            this.request.filters = {};
        }
        this.request.filters.lowStockThreshold = threshold;
        return this;
    }

    setCategory(category: string): this {
        if (!this.request.filters) {
            this.request.filters = {};
        }
        this.request.filters.category = category;
        return this;
    }

    setInStockOnly(inStockOnly: boolean): this {
        if (!this.request.filters) {
            this.request.filters = {};
        }
        this.request.filters.inStockOnly = inStockOnly;
        return this;
    }

    setFilters(filters: InventoryFilters): this {
        this.request.filters = filters;
        return this;
    }

    build(): InventoryQueryRequest {
        if (!this.request.locationId) {
            throw new Error('Location ID is required');
        }

        return {
            locationId: this.request.locationId,
            limit: this.request.limit || 100,
            offset: this.request.offset || 0,
            filters: this.request.filters || {}
        };
    }
}

/**
 * Builder for Inventory Query Results
 */
export class InventoryQueryResultBuilder {
    private result: Partial<InventoryQueryResult> = {
        items: [],
        totalCount: 0,
        filteredCount: 0,
        timestamp: new Date().toISOString()
    };

    setSuccess(success: boolean): this {
        this.result.success = success;
        return this;
    }

    setItems(items: InventoryItem[]): this {
        this.result.items = items;
        this.result.filteredCount = items.length;
        return this;
    }

    addItem(item: InventoryItem): this {
        if (!this.result.items) {
            this.result.items = [];
        }
        this.result.items.push(item);
        this.result.filteredCount = this.result.items.length;
        return this;
    }

    setTotalCount(totalCount: number): this {
        this.result.totalCount = totalCount;
        return this;
    }

    setLocationId(locationId: string): this {
        this.result.locationId = locationId;
        return this;
    }

    setMessage(message: string): this {
        this.result.message = message;
        return this;
    }

    setError(error: string): this {
        this.result.error = error;
        this.result.success = false;
        return this;
    }

    build(): InventoryQueryResult {
        if (!this.result.locationId) {
            throw new Error('Location ID is required in result');
        }

        return {
            success: this.result.success ?? true,
            items: this.result.items || [],
            totalCount: this.result.totalCount || 0,
            filteredCount: this.result.filteredCount || 0,
            locationId: this.result.locationId,
            timestamp: this.result.timestamp!,
            message: this.result.message,
            error: this.result.error
        };
    }
}

/**
 * Factory functions for builders
 */
export function createInventoryQueryRequestBuilder(): InventoryQueryRequestBuilder {
    return new InventoryQueryRequestBuilder();
}

export function createInventoryQueryResultBuilder(): InventoryQueryResultBuilder {
    return new InventoryQueryResultBuilder();
}
