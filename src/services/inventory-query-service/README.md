# Inventory Query Service

This service provides inventory querying functionality with automatic token management and filtering capabilities. It integrates with the token validation service to ensure authentication is handled seamlessly.

## Features

- **Automatic Token Management**: Automatically validates and refreshes tokens as needed
- **Inventory Querying**: Retrieve inventory items for a specific location
- **Low Stock Filtering**: Filter items that are below stock thresholds
- **Pagination Support**: Handle large inventories with limit and offset
- **Builder Pattern**: Fluent API for constructing requests and responses
- **Comprehensive Error Handling**: Detailed error messages and status tracking

## Usage

### Basic Inventory Query

```typescript
import { createInventoryQueryService, createInventoryQueryRequestBuilder } from './services/inventory-query-service';

// Create the service instance
const inventoryService = createInventoryQueryService(
    credentialsStub,
    clientId,
    clientSecret
);

// Build a query request
const request = createInventoryQueryRequestBuilder()
    .setLocationId("loc_123456")
    .setLimit(50)
    .setOffset(0)
    .build();

// Execute the query
const result = await inventoryService.queryInventory(request);

if (result.success) {
    console.log(`Found ${result.items.length} items`);
    result.items.forEach(item => {
        console.log(`${item.name} - SKU: ${item.sku} - Quantity: ${item.quantity}`);
    });
} else {
    console.error('Query failed:', result.error);
}
```

### Query Low Stock Items

```typescript
// Query items that are low on stock
const lowStockRequest = createInventoryQueryRequestBuilder()
    .setLocationId("loc_123456")
    .setFilters({ lowStockThreshold: 5 })
    .build();

const lowStockResult = await inventoryService.queryLowStockItems(lowStockRequest);

if (lowStockResult.success) {
    console.log(`Found ${lowStockResult.items.length} low-stock items`);
    lowStockResult.items.forEach(item => {
        console.log(`LOW STOCK: ${item.name} - Only ${item.quantity} left!`);
    });
}
```

### Filtered Inventory Query

```typescript
// Query with multiple filters
const filteredRequest = createInventoryQueryRequestBuilder()
    .setLocationId("loc_123456")
    .setLimit(100)
    .setFilters({
        category: "electronics",
        inStockOnly: true,
        lowStockThreshold: 10
    })
    .build();

const filteredResult = await inventoryService.queryInventory(filteredRequest);
```

### Using in a Worker Handler

```typescript
// In your main worker index.ts
import { createInventoryQueryService, createInventoryQueryRequestBuilder } from './services/inventory-query-service';

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        
        if (url.pathname === '/api/inventory') {
            const locationId = url.searchParams.get('locationId');
            const limit = parseInt(url.searchParams.get('limit') || '50');
            const lowStockOnly = url.searchParams.get('lowStock') === 'true';
            
            if (!locationId) {
                return new Response('Missing locationId parameter', { status: 400 });
            }
            
            // Create service instance
            const credentialsStub = env.CREDENTIALS_DURABLE_OBJECT.get(
                env.CREDENTIALS_DURABLE_OBJECT.idFromName(locationId)
            );
            
            const inventoryService = createInventoryQueryService(
                credentialsStub,
                env.CLIENT_ID,
                env.CLIENT_SECRET
            );
            
            // Build request
            const requestBuilder = createInventoryQueryRequestBuilder()
                .setLocationId(locationId)
                .setLimit(limit);
            
            if (lowStockOnly) {
                requestBuilder.setFilters({ lowStockThreshold: 5 });
            }
            
            const inventoryRequest = requestBuilder.build();
            
            // Execute query
            const result = lowStockOnly 
                ? await inventoryService.queryLowStockItems(inventoryRequest)
                : await inventoryService.queryInventory(inventoryRequest);
            
            return new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        return new Response('Not found', { status: 404 });
    }
};
```

### Handling Results

```typescript
// Process inventory query results
const result = await inventoryService.queryInventory(request);

if (result.success) {
    // Success case
    console.log(`Total items in location: ${result.totalCount}`);
    console.log(`Items returned: ${result.items.length}`);
    console.log(`Message: ${result.message}`);
    
    // Process each item
    result.items.forEach(item => {
        if (item.isLowStock) {
            console.warn(`⚠️  ${item.name} is low on stock (${item.quantity} remaining)`);
        }
        
        console.log(`📦 ${item.name}`);
        console.log(`   SKU: ${item.sku}`);
        console.log(`   Category: ${item.category}`);
        console.log(`   Quantity: ${item.quantity}`);
        console.log(`   Price: $${item.price}`);
    });
} else {
    // Error case
    console.error('Inventory query failed:', result.error);
    
    // Handle specific error types
    if (result.error?.includes('credentials')) {
        console.log('Authentication issue - check OAuth setup');
    } else if (result.error?.includes('network')) {
        console.log('Network issue - retry may help');
    }
}
```

## API Reference

### InventoryQueryService

Main service class for inventory operations.

#### Methods

- `queryInventory(request: InventoryQueryRequest): Promise<InventoryQueryResult>`
  - Queries inventory with automatic token management
  - Supports filtering and pagination

- `queryLowStockItems(request: InventoryQueryRequest): Promise<InventoryQueryResult>`
  - Specifically queries for low-stock items
  - Applies low-stock filtering automatically

### InventoryQueryRequestBuilder

Builder for constructing inventory query requests.

#### Methods

- `setLocationId(locationId: string): this`
- `setLimit(limit: number): this`
- `setOffset(offset: number): this`
- `setFilters(filters: object): this`
- `build(): InventoryQueryRequest`

### InventoryQueryResultBuilder

Builder for constructing inventory query responses.

#### Methods

- `setLocationId(locationId: string): this`
- `setItems(items: InventoryItem[]): this`
- `setTotalCount(count: number): this`
- `setMessage(message: string): this`
- `setError(error: string): this`
- `build(): InventoryQueryResult`

## Integration

This service integrates with:
- **Token Management Service**: For automatic token validation and refresh
- **Credentials Durable Object**: For storing and retrieving OAuth credentials
- **External Inventory API**: For fetching actual inventory data

The service automatically handles token expiration and refresh, so you don't need to manage authentication manually.
