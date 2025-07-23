# Add Bounded Context Workflow

**Focus**: Adding a new bounded context to existing DDD project
**Time**: 10-20 minutes
**Result**: New domain integrated with existing contexts

## Overview

This workflow shows how to add a new bounded context to an existing VytchesDDD project, ensuring proper integration with current domains and maintaining clean architecture boundaries.

## Prerequisites

- Existing DDD project with VytchesDDD
- At least one domain already implemented
- Understanding of domain relationships

## Step 1: Analyze Existing Architecture

```bash
# Map current domains and their relationships
vytches-ddd domain --context-map

# Analyze what exists
ls src/domain/
```

**Context Map Output:**
```
📊 Current Architecture Analysis

Existing Domains:
├── UserManagement (Customer-Supplier) 
│   ├── User aggregate
│   ├── Authentication services
│   └── Profile management
└── OrderManagement (Downstream)
    ├── Order aggregate  
    ├── Payment processing
    └── Fulfillment tracking

Identified Integration Points:
- UserManagement → OrderManagement (User creates orders)
- OrderManagement needs Product information (missing domain)
- Payment processing needs external gateway integration
```

## Step 2: Define New Domain Requirements

```bash
# Start guided analysis for new domain
vytches-ddd domain ProductCatalog --guided
```

**Guided Analysis:**
```
🧠 Domain Analysis Assistant

? What business problem does this domain solve?  
> "Manage product information, pricing, categories, and inventory for e-commerce"

? How does this relate to existing domains?
> "OrderManagement needs product data for order creation and validation"

? Key business entities?
> Product, Category, Brand, Inventory, Price

? Integration requirements?
  ✓ OrderManagement reads product data
  ✓ Inventory updates from external systems
  ✓ Price changes trigger notifications
  ✓ Category management for navigation

💡 AI Analysis: Product Catalog is a Upstream/Customer domain
   - Provides product data to OrderManagement  
   - Receives inventory updates from external systems
   - Publishes pricing and availability events

? Generate with these integration patterns? Yes
```

## Step 3: Generate New Domain Structure

```bash
# Generate domain with integration patterns
vytches-ddd domain ProductCatalog --template ecommerce --with-integration
```

**Generated Structure:**
```
src/domain/product-catalog/
├── aggregates/
│   ├── product.aggregate.ts          # Main product entity
│   ├── category.aggregate.ts         # Product categorization  
│   └── inventory.aggregate.ts        # Stock management
├── entities/
│   ├── brand.entity.ts
│   ├── product-variant.entity.ts
│   └── price-history.entity.ts
├── value-objects/
│   ├── product-id.vo.ts
│   ├── sku.vo.ts
│   ├── price.vo.ts
│   └── stock-level.vo.ts
├── events/
│   ├── product-created.event.ts
│   ├── price-changed.event.ts
│   ├── inventory-updated.event.ts
│   └── product-discontinued.event.ts
├── commands/
│   ├── create-product.command.ts
│   ├── update-price.command.ts
│   └── adjust-inventory.command.ts
├── queries/
│   ├── get-product-details.query.ts
│   ├── search-products.query.ts
│   └── get-inventory-status.query.ts
├── services/
│   ├── pricing.service.ts
│   └── inventory-management.service.ts
├── repositories/
│   └── product.repository.ts
└── acl/                              # Anti-corruption layers
    ├── external-inventory.acl.ts
    └── pricing-service.acl.ts
```

## Step 4: Define Integration Contracts

```bash
# Generate shared contracts for domain integration
vytches-ddd generate contract ProductData --for-domains OrderManagement,ProductCatalog
```

**Generated Contract:**
```typescript
// src/shared/contracts/product-data.contract.ts
export interface ProductDataContract {
  id: string;
  name: string;
  price: number;
  currency: string;
  availableQuantity: number;
  isActive: boolean;
}

// Integration event for price changes
export class ProductPriceChangedIntegrationEvent {
  constructor(
    public readonly productId: string,
    public readonly oldPrice: number,
    public readonly newPrice: number,
    public readonly effectiveDate: Date,
    public readonly currency: string
  ) {}
}

// Query interface for order management to use
export interface IProductQueryService {
  getProductById(id: string): Promise<ProductDataContract | null>;
  checkAvailability(productId: string, quantity: number): Promise<boolean>;
  getProductsByIds(ids: string[]): Promise<ProductDataContract[]>;
}
```

## Step 5: Update Existing Domains

```bash
# Update OrderManagement to integrate with ProductCatalog
vytches-ddd domain OrderManagement --add-integration ProductCatalog
```

**Updated Order Aggregate:**
```typescript
// src/domain/order-management/aggregates/order.aggregate.ts
import { ProductDataContract } from '@shared/contracts/product-data.contract';

export class OrderAggregate extends AggregateRoot {
  // ... existing code

  static async create(
    command: CreateOrderCommand,
    productQueryService: IProductQueryService
  ): Promise<OrderAggregate> {
    // Validate products exist and are available
    const productData = await productQueryService.getProductsByIds(
      command.items.map(item => item.productId)
    );

    if (productData.length !== command.items.length) {
      throw new DomainError('Some products not found');
    }

    // Validate availability
    for (const item of command.items) {
      const product = productData.find(p => p.id === item.productId);
      if (!product || !product.isActive) {
        throw new DomainError(`Product ${item.productId} is not available`);
      }

      const isAvailable = await productQueryService.checkAvailability(
        item.productId,
        item.quantity
      );
      
      if (!isAvailable) {
        throw new DomainError(`Insufficient stock for product ${item.productId}`);
      }
    }

    const order = new OrderAggregate(
      generateId(),
      command.customerId,
      command.items.map(item => {
        const product = productData.find(p => p.id === item.productId)!;
        return OrderItem.create(item, product.price, product.currency);
      }),
      OrderStatus.CREATED
    );

    order.addDomainEvent(new OrderCreatedEvent(
      order.id,
      order.customerId,
      order.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.unitPrice
      }))
    ));

    return order;
  }
}
```

## Step 6: Implement Integration Events

```bash
# Generate event handlers for cross-domain communication
vytches-ddd generate event-handler ProductPriceChanged --domain OrderManagement
vytches-ddd generate event-handler InventoryUpdated --domain OrderManagement
```

**Generated Event Handler:**
```typescript
// src/application/order-management/handlers/product-price-changed.handler.ts
import { EventHandler, IEventHandler } from '@vytches-ddd/events';
import { ProductPriceChangedIntegrationEvent } from '@shared/contracts/product-data.contract';

@EventHandler(ProductPriceChangedIntegrationEvent)
export class ProductPriceChangedHandler implements IEventHandler<ProductPriceChangedIntegrationEvent> {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly notificationService: INotificationService
  ) {}

  async handle(event: ProductPriceChangedIntegrationEvent): Promise<void> {
    // Find pending orders with this product
    const pendingOrders = await this.orderRepository.findPendingOrdersWithProduct(
      event.productId
    );

    for (const order of pendingOrders) {
      // Recalculate order totals if price increased significantly
      const priceIncrease = (event.newPrice - event.oldPrice) / event.oldPrice;
      
      if (priceIncrease > 0.1) { // 10% increase threshold
        order.recalculateWithNewPrice(event.productId, event.newPrice);
        
        // Notify customer about price change
        await this.notificationService.notifyPriceChange(
          order.customerId,
          order.id,
          event.productId,
          event.oldPrice,
          event.newPrice
        );
      }
      
      await this.orderRepository.save(order);
    }
  }
}
```

## Step 7: Set Up Anti-Corruption Layers

```bash
# Generate ACL for external inventory system
vytches-ddd generate acl ExternalInventory --domain ProductCatalog
```

**Generated ACL:**
```typescript
// src/domain/product-catalog/acl/external-inventory.acl.ts
export class ExternalInventoryACL {
  constructor(
    private readonly externalInventoryApi: IExternalInventoryAPI,
    private readonly logger: ILogger
  ) {}

  async syncInventoryLevel(productId: string): Promise<StockLevel> {
    try {
      // External API call
      const externalData = await this.externalInventoryApi.getStock(productId);
      
      // Transform external format to domain format
      return StockLevel.create({
        productId,
        quantity: externalData.available_quantity,
        reservedQuantity: externalData.reserved_qty,
        lastUpdated: new Date(externalData.last_sync_timestamp),
        source: 'EXTERNAL_SYSTEM'
      });
      
    } catch (error) {
      this.logger.error('Failed to sync inventory', { productId, error });
      
      // Return safe default or cached value
      return StockLevel.unavailable(productId);
    }
  }

  async bulkSyncInventory(productIds: string[]): Promise<Map<string, StockLevel>> {
    const results = new Map<string, StockLevel>();
    
    // Batch API calls for efficiency
    const batchSize = 50;
    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      
      try {
        const batchData = await this.externalInventoryApi.getBulkStock(batch);
        
        for (const [productId, data] of Object.entries(batchData)) {
          results.set(productId, StockLevel.create({
            productId,
            quantity: data.available_quantity,
            reservedQuantity: data.reserved_qty,
            lastUpdated: new Date(data.last_sync_timestamp),
            source: 'EXTERNAL_SYSTEM'
          }));
        }
        
      } catch (error) {
        this.logger.error('Batch inventory sync failed', { batch, error });
        
        // Add fallback values for failed batch
        for (const productId of batch) {
          results.set(productId, StockLevel.unavailable(productId));
        }
      }
    }
    
    return results;
  }
}
```

## Step 8: Update Application Bootstrap

```bash
# Update main application to include new domain
```

**Updated src/index.ts:**
```typescript
// Add new imports
import { ProductQueryService } from './application/product-catalog/services/product-query.service';
import { CreateProductHandler } from './application/product-catalog/handlers/create-product.handler';
import { ProductPriceChangedHandler } from './application/order-management/handlers/product-price-changed.handler';
import { InMemoryProductRepository } from './infrastructure/product-catalog/product.repository';

async function bootstrap() {
  // ... existing setup

  // Add new repositories
  const productRepository = new InMemoryProductRepository();
  
  // Add new services  
  const productQueryService = new ProductQueryService(productRepository);

  // Register new handlers
  commandBus.register(CreateProductHandler);
  eventBus.subscribe(ProductPriceChangedHandler);

  // Update existing handlers with new dependencies
  const createOrderHandler = new CreateOrderHandler(
    orderRepository,
    productQueryService  // Now injected
  );
  commandBus.register(CreateOrderCommand, createOrderHandler);

  console.log('🚀 Application updated with ProductCatalog domain!');
  
  await demonstrateIntegration(commandBus, queryBus);
}

async function demonstrateIntegration(commandBus: CommandBus, queryBus: QueryBus) {
  // 1. Create a product
  await commandBus.execute(new CreateProductCommand({
    name: 'Wireless Headphones',
    price: 99.99,
    currency: 'USD',
    categoryId: 'electronics',
    initialStock: 50
  }));
  console.log('✅ Product created');

  // 2. Create order with product validation
  await commandBus.execute(new CreateOrderCommand(
    'user-123',
    [{ productId: 'product-1', quantity: 2 }],
    { street: '123 Main St', city: 'NYC', zipCode: '10001' }
  ));
  console.log('✅ Order created with product validation');

  // 3. Update product price (triggers event)
  await commandBus.execute(new UpdateProductPriceCommand(
    'product-1',
    119.99,
    new Date()
  ));
  console.log('✅ Product price updated, orders notified');
}
```

## Step 9: Add Tests for Integration

```bash
# Generate integration tests
vytches-ddd generate integration-test ProductCatalogOrderManagement --domains ProductCatalog,OrderManagement
```

**Generated Integration Test:**
```typescript
// tests/integration/product-catalog-order-management.test.ts
import { ProductQueryService } from '@application/product-catalog/services/product-query.service';
import { CreateOrderHandler } from '@application/order-management/handlers/create-order.handler';

describe('ProductCatalog <-> OrderManagement Integration', () => {
  let productQueryService: ProductQueryService;
  let createOrderHandler: CreateOrderHandler;

  beforeEach(() => {
    // Setup test dependencies
  });

  it('should validate product availability when creating order', async () => {
    // Arrange
    const productId = 'test-product-1';
    await seedProduct(productId, { stock: 10, price: 50.00 });

    const createOrderCommand = new CreateOrderCommand(
      'customer-1',
      [{ productId, quantity: 5 }],
      mockShippingAddress
    );

    // Act
    const result = await createOrderHandler.execute(createOrderCommand);

    // Assert
    expect(result.isSuccess).toBe(true);
    expect(result.value.items).toHaveLength(1);
    expect(result.value.items[0].unitPrice).toBe(50.00);
  });

  it('should reject order when product out of stock', async () => {
    // Arrange
    const productId = 'test-product-2';
    await seedProduct(productId, { stock: 2, price: 30.00 });

    const createOrderCommand = new CreateOrderCommand(
      'customer-1',
      [{ productId, quantity: 5 }], // More than available
      mockShippingAddress
    );

    // Act & Assert
    await expect(createOrderHandler.execute(createOrderCommand))
      .rejects.toThrow('Insufficient stock');
  });

  it('should handle price changes for pending orders', async () => {
    // Test price change event handling
  });
});
```

## Step 10: Validate Integration

```bash
# Validate all domains and their relationships
vytches-ddd domain --validate-all

# Check integration patterns
vytches-ddd domain --context-map --validate-integration
```

**Validation Results:**
```
🔍 Domain Integration Validation

✅ ProductCatalog Domain
   - Clear aggregate boundaries
   - Proper event publishing
   - ACL for external systems

✅ OrderManagement Domain  
   - Updated with product integration
   - Event handlers registered
   - Error handling for unavailable products

✅ Integration Patterns
   - Shared contracts defined
   - Event-driven communication
   - Anti-corruption layers in place
   - No circular dependencies

📊 Updated Context Map:
┌─────────────────┬──────────────────┬─────────────────┐
│ Domain          │ Relationship     │ Integration     │
├─────────────────┼──────────────────┼─────────────────┤
│ ProductCatalog  │ Customer-Supplier│ Events/Queries  │
│ → OrderMgmt     │                  │                 │
├─────────────────┼──────────────────┼─────────────────┤
│ UserManagement  │ Customer-Supplier│ Commands/Events │
│ → OrderMgmt     │                  │                 │
├─────────────────┼──────────────────┼─────────────────┤
│ ProductCatalog  │ Conformist       │ ACL Layer       │
│ ← External Inv  │                  │                 │
└─────────────────┴──────────────────┴─────────────────┘

Score: 95/100 (Excellent integration)
```

## Common Integration Patterns

### 1. Customer-Supplier Pattern
```typescript
// Downstream domain depends on upstream
// OrderManagement (Customer) ← ProductCatalog (Supplier)

// Query interface for downstream to use
export interface IProductQueryService {
  getProductById(id: string): Promise<ProductDataContract | null>;
}
```

### 2. Event-Driven Integration
```typescript
// Upstream publishes events, downstream subscribes
@EventHandler(ProductPriceChangedIntegrationEvent)
export class PriceChangeHandler {
  async handle(event: ProductPriceChangedIntegrationEvent): Promise<void> {
    // React to price changes
  }
}
```

### 3. Anti-Corruption Layer
```typescript
// Protect domain from external system complexity
export class ExternalInventoryACL {
  async getInventoryLevel(productId: string): Promise<StockLevel> {
    // Transform external data to domain format
  }
}
```

### 4. Shared Kernel
```typescript
// Shared value objects across domains
export class Money extends ValueObject<{amount: number, currency: string}> {
  // Used by both OrderManagement and ProductCatalog
}
```

## Tips for Success

### Planning
- **Map relationships first**: Use `--context-map` before adding domains
- **Define contracts early**: Create shared interfaces before implementation
- **Start with queries**: Read-side integration is usually simpler than commands

### Implementation
- **Use events for loose coupling**: Avoid direct domain-to-domain calls
- **Implement ACL for external systems**: Protect your domain model
- **Test integration patterns**: Write integration tests, not just unit tests

### Maintenance
- **Validate regularly**: Run `--validate-all` after changes
- **Monitor integration points**: Log and track cross-domain calls
- **Version contracts**: Use semantic versioning for shared interfaces

## Troubleshooting

**Circular dependencies?**
```bash
vytches-ddd domain --context-map --check-cycles
```

**Integration events not firing?**
```bash
vytches-ddd validate --check-event-handlers --domain OrderManagement
```

**ACL translation errors?**
```bash
vytches-ddd generate test ExternalInventoryACL --integration
```

## Next Steps

1. **Add more integrations**: Payment gateway, shipping service
2. **Implement sagas**: For complex cross-domain transactions  
3. **Add monitoring**: Track integration health and performance
4. **Consider splitting**: When domains become too coupled, consider microservices