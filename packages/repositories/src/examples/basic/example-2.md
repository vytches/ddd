# Event-Sourced Repository - Event Stream Management

**Version**: 1.0.0
**Package**: @vytches-ddd/repositories
**Complexity**: beginner
**Domain**: product-management
**Patterns**: event-sourcing, event-store, aggregate-reconstruction
**Dependencies**: @vytches-ddd/repositories, @vytches-ddd/events

## Description
Event-sourced repository implementation showing how to persist and reconstruct aggregates from event streams using the @vytches-ddd/repositories event store capabilities.

## Business Context
Product catalog system requiring complete audit trails and ability to replay state changes. Event sourcing provides immutable history and enables temporal queries for business analytics.

## Code Example

```typescript
// product-event-repository.ts
import { EventSourcedRepository } from '@vytches-ddd/repositories';
import { EntityId, DomainEvent } from '@vytches-ddd/domain-primitives';
import { Product, CreateProductData, StoredEvent, EventStream } from './types'; // From your application

// ✅ FOCUS: Event-sourced repository using library EventSourcedRepository
export class ProductEventRepository extends EventSourcedRepository<Product> {
  constructor() {
    super('products'); // Aggregate type
  }

  // ✅ FOCUS: Create product with initial events
  async createProduct(productData: CreateProductData): Promise<Product> {
    const productId = EntityId.generate();
    
    // Create initial domain events
    const events: DomainEvent[] = [
      {
        eventId: EntityId.generate().value,
        eventType: 'ProductCreated',
        aggregateId: productId.value,
        aggregateType: 'Product',
        eventData: {
          name: productData.name,
          description: productData.description,
          price: productData.price,
          category: productData.category,
          sku: productData.sku,
          tags: productData.tags || []
        },
        eventVersion: 1,
        timestamp: new Date(),
        metadata: {}
      }
    ];

    if (productData.initialQuantity && productData.initialQuantity > 0) {
      events.push({
        eventId: EntityId.generate().value,
        eventType: 'InventoryAdded',
        aggregateId: productId.value,
        aggregateType: 'Product',
        eventData: {
          quantity: productData.initialQuantity,
          minStock: productData.minStock || 0
        },
        eventVersion: 2,
        timestamp: new Date(),
        metadata: {}
      });
    }

    // ✅ FOCUS: Use library saveEvents method
    await this.saveEvents(productId, events, 0); // Expected version 0 (new aggregate)
    
    // Reconstruct and return the product
    return await this.getById(productId);
  }

  // ✅ FOCUS: Load product by reconstructing from events
  async getProductById(id: string): Promise<Product | null> {
    const productId = EntityId.fromString(id);
    return await this.getById(productId);
  }

  // ✅ FOCUS: Update product by appending events
  async updateProductPrice(id: string, newPrice: number, reason: string): Promise<Product | null> {
    const productId = EntityId.fromString(id);
    
    // Load current version
    const currentProduct = await this.getById(productId);
    if (!currentProduct) return null;

    // Create price update event
    const priceUpdateEvent: DomainEvent = {
      eventId: EntityId.generate().value,
      eventType: 'ProductPriceChanged',
      aggregateId: productId.value,
      aggregateType: 'Product',
      eventData: {
        oldPrice: currentProduct.price,
        newPrice,
        reason
      },
      eventVersion: currentProduct.version + 1,
      timestamp: new Date(),
      metadata: { reason }
    };

    // ✅ FOCUS: Append event using library method
    await this.saveEvents(productId, [priceUpdateEvent], currentProduct.version);
    
    // Return updated product
    return await this.getById(productId);
  }

  async addProductTags(id: string, newTags: string[]): Promise<Product | null> {
    const productId = EntityId.fromString(id);
    const currentProduct = await this.getById(productId);
    if (!currentProduct) return null;

    const tagsAddedEvent: DomainEvent = {
      eventId: EntityId.generate().value,
      eventType: 'ProductTagsAdded',
      aggregateId: productId.value,
      aggregateType: 'Product',
      eventData: {
        addedTags: newTags,
        previousTags: currentProduct.tags
      },
      eventVersion: currentProduct.version + 1,
      timestamp: new Date(),
      metadata: {}
    };

    await this.saveEvents(productId, [tagsAddedEvent], currentProduct.version);
    return await this.getById(productId);
  }

  // ✅ FOCUS: Get event history using library methods
  async getProductHistory(id: string): Promise<StoredEvent[]> {
    const productId = EntityId.fromString(id);
    
    // Use library getEventStream method
    const eventStream = await this.getEventStream(productId);
    return eventStream?.events || [];
  }

  async getProductVersionAt(id: string, timestamp: Date): Promise<Product | null> {
    const productId = EntityId.fromString(id);
    
    // ✅ FOCUS: Reconstruct aggregate at specific point in time
    return await this.getVersionAt(productId, timestamp);
  }

  // ✅ FOCUS: Query operations across event streams
  async getAllProductIds(): Promise<string[]> {
    // Use library getAllStreamIds method
    return await this.getAllStreamIds();
  }

  async getRecentProductEvents(limit: number = 10): Promise<StoredEvent[]> {
    // ✅ FOCUS: Query recent events across all streams
    return await this.getRecentEvents(limit);
  }

  // ✅ FOCUS: Event stream management
  async getProductEventCount(id: string): Promise<number> {
    const productId = EntityId.fromString(id);
    const eventStream = await this.getEventStream(productId);
    return eventStream?.events.length || 0;
  }

  async streamExists(id: string): Promise<boolean> {
    const productId = EntityId.fromString(id);
    const stream = await this.getEventStream(productId);
    return stream !== null;
  }

  // ✅ FOCUS: Advanced event sourcing operations
  protected reconstructFromEvents(events: StoredEvent[]): Product {
    // Reconstruct product state from events
    if (events.length === 0) {
      throw new Error('Cannot reconstruct product from empty event stream');
    }

    // Start with initial state from first event
    const firstEvent = events[0];
    let product: Product = {
      id: firstEvent.aggregateId,
      name: '',
      description: '',
      price: 0,
      category: '',
      sku: '',
      tags: [],
      isActive: true,
      inventory: {
        quantity: 0,
        reserved: 0,
        available: 0,
        minStock: 0,
        locations: []
      },
      createdAt: firstEvent.timestamp,
      updatedAt: firstEvent.timestamp,
      version: 0
    };

    // Apply each event to build current state
    for (const event of events) {
      product = this.applyEvent(product, event);
      product.version = event.streamVersion;
      product.updatedAt = event.timestamp;
    }

    return product;
  }

  private applyEvent(product: Product, event: StoredEvent): Product {
    switch (event.eventType) {
      case 'ProductCreated':
        return {
          ...product,
          name: event.eventData.name,
          description: event.eventData.description,
          price: event.eventData.price,
          category: event.eventData.category,
          sku: event.eventData.sku,
          tags: event.eventData.tags || []
        };

      case 'ProductPriceChanged':
        return {
          ...product,
          price: event.eventData.newPrice
        };

      case 'ProductTagsAdded':
        return {
          ...product,
          tags: [...product.tags, ...event.eventData.addedTags]
        };

      case 'InventoryAdded':
        return {
          ...product,
          inventory: {
            ...product.inventory,
            quantity: product.inventory.quantity + event.eventData.quantity,
            available: product.inventory.available + event.eventData.quantity,
            minStock: event.eventData.minStock || product.inventory.minStock
          }
        };

      default:
        return product;
    }
  }
}

// Usage Example
async function demonstrateEventSourcing() {
  const productRepo = new ProductEventRepository();

  // Create product with events
  const newProduct = await productRepo.createProduct({
    name: 'Gaming Laptop',
    description: 'High-performance gaming laptop',
    price: 1299.99,
    category: 'electronics',
    sku: 'LAPTOP-001',
    tags: ['gaming', 'laptop'],
    initialQuantity: 50,
    minStock: 10
  });
  console.log('Created product:', newProduct.id);

  // Update price (creates new event)
  const updatedProduct = await productRepo.updateProductPrice(
    newProduct.id,
    1199.99,
    'Holiday discount'
  );
  console.log('Updated price:', updatedProduct?.price);

  // View event history
  const history = await productRepo.getProductHistory(newProduct.id);
  console.log('Event history count:', history.length);
  
  for (const event of history) {
    console.log(`Event: ${event.eventType} at ${event.timestamp}`);
  }

  // Time travel - get product state at specific time
  const pastState = await productRepo.getProductVersionAt(
    newProduct.id,
    new Date(Date.now() - 3600000) // 1 hour ago
  );
  console.log('Past state price:', pastState?.price);
}
```

## Key Features
- Event-sourced persistence with complete audit trail
- Aggregate reconstruction from event streams
- Time travel queries (point-in-time state reconstruction)
- Optimistic concurrency control with event versioning
- Event stream management and querying capabilities

## Common Pitfalls
- Not handling event versioning properly for concurrency control
- Forgetting to implement all event types in reconstruction logic
- Creating too many fine-grained events (performance impact)
- Not considering event schema evolution for long-term storage

## Related Examples
- [Generic Repository Pattern](example-1.md) - Basic CRUD operations
- [Cached Repository](example-3.md) - Repository with caching layer