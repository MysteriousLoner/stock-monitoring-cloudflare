/**
 * Inventory Query Service - Main Module
 * Provides inventory querying with automatic token management
 */

export { InventoryQueryService, createInventoryQueryService } from './query-inventory';
export type {
    InventoryQueryRequest,
    InventoryQueryResult,
    InventoryItem,
    InventoryCredentials
} from './types';
export {
    InventoryQueryRequestBuilder,
    InventoryQueryResultBuilder,
    createInventoryQueryRequestBuilder,
    createInventoryQueryResultBuilder
} from './types';
