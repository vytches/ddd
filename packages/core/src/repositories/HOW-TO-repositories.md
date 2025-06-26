# Repository Pattern in DomainTS - LLM-Optimized Guide

## Document Metadata

- **Pattern Name**: Repository Pattern
- **Category**: Domain-Driven Design (DDD) Pattern
- **Purpose**: Encapsulate persistence logic for aggregates
- **Library**: DomainTS
- **Language**: TypeScript
- **Version**: 1.0.0

## Pattern Overview

### What are Repositories?

Repositories provide a collection-like interface for accessing aggregates. They encapsulate persistence logic and act as an in-memory collection of domain objects, hiding the details of data storage.

**Core Principle**: Repositories deal only with aggregate roots, not individual entities within aggregates.

### Primary Use Cases

1. **Aggregate Persistence**: Save and retrieve aggregate roots
2. **Data Access Abstraction**: Hide storage implementation details
3. **Domain Event Integration**: Dispatch events after persistence
4. **Concurrency Control**: Manage aggregate versions

## Core Components

### 1. IRepository Interface

Basic repository contract with minimal operations:

```typescript
interface IRepository<T extends IAggregateRoot<any>> {
  // Find aggregate by ID
  findById?(id: any): Promise<T | null>;
  
  // Save aggregate (create or update)
  save(aggregate: T): Promise<void>;
  
  // Delete aggregate
  delete?(aggregate: T): Promise<void>;
}
```

### 2. IExtendedRepository Interface

Extended functionality for advanced use cases:

```typescript
interface IExtendedRepository<T extends IAggregateRoot<any>> extends IRepository<T> {
  // Check existence
  exists(id: any): Promise<boolean>;
  
  // Find by specification
  findBySpecification?(spec: any): Promise<T[]>;
  findOneBySpecification?(spec: any): Promise<T | null>;
}
```

### 3. IBaseRepository Abstract Class

Base implementation with event handling and versioning:

```typescript
abstract class IBaseRepository {
  constructor(protected readonly eventDispatcher: IEventDispatcher);
  
  async save(aggregate: AggregateRoot): Promise<void> {
    // 1. Get domain events from aggregate
    // 2. Check version for optimistic concurrency
    // 3. Apply event handlers
    // 4. Dispatch events
  }
  
  abstract getCurrentVersion(id: any): Promise<number>;
}
```

## Key Concepts

### Aggregate-Only Access

Repositories only handle aggregate roots, never individual entities:

```typescript
// Correct
orderRepository.findById(orderId);

// Incorrect - OrderItem is not an aggregate root
orderItemRepository.findById(itemId); // ❌
```

### Event Integration

The `IBaseRepository` automatically handles domain events during save:

1. Extracts events from aggregate
2. Applies event handlers to update state
3. Dispatches events to event dispatcher

### Optimistic Concurrency Control

Version checking prevents concurrent modifications:

```typescript
const currentVersion = await this.getCurrentVersion(aggregate.getId());
if (initialVersion !== currentVersion) {
  throw VersionError.withEntityIdAndVersions(
    aggregate.getId(),
    currentVersion,
    initialVersion
  );
}
```

### Event Handler Convention

Repositories must implement handlers for domain events:

```typescript
class OrderRepository extends IBaseRepository {
  // Handler for OrderCreated event
  async handleOrderCreated(payload: OrderCreatedPayload): Promise<void> {
    // Persist order data
  }
  
  // Handler for OrderShipped event
  async handleOrderShipped(payload: OrderShippedPayload): Promise<void> {
    // Update order status
  }
}
```

## Implementation Pattern

### Basic Repository Implementation

```typescript
class OrderRepository implements IRepository<Order> {
  async findById(id: OrderId): Promise<Order | null> {
    // Fetch from database
    const data = await this.db.orders.findOne({ id: id.getValue() });
    if (!data) return null;
    
    // Reconstruct aggregate
    return OrderMapper.toDomain(data);
  }
  
  async save(order: Order): Promise<void> {
    // Convert to persistence model
    const data = OrderMapper.toPersistence(order);
    
    // Save to database
    await this.db.orders.upsert(data);
  }
  
  async delete(order: Order): Promise<void> {
    await this.db.orders.delete({ id: order.getId().getValue() });
  }
}
```

### Event-Sourced Repository

```typescript
class EventSourcedOrderRepository extends IBaseRepository {
  async getCurrentVersion(id: OrderId): Promise<number> {
    const events = await this.eventStore.getEvents(id.getValue());
    return events.length;
  }
  
  async handleOrderCreated(payload: OrderCreatedPayload): Promise<void> {
    await this.eventStore.append({
      aggregateId: payload.orderId,
      eventType: 'OrderCreated',
      payload
    });
  }
  
  async findById(id: OrderId): Promise<Order | null> {
    const events = await this.eventStore.getEvents(id.getValue());
    if (events.length === 0) return null;
    
    // Rebuild aggregate from events
    return Order.fromEvents(events);
  }
}
```

## Best Practices

### 1. Aggregate Boundaries

Only create repositories for aggregate roots:

```typescript
// Correct
class OrderRepository implements IRepository<Order> { }
class CustomerRepository implements IRepository<Customer> { }

// Incorrect - these are not aggregate roots
class OrderItemRepository { } // ❌
class AddressRepository { } // ❌
```

### 2. Specification Pattern Integration

Use specifications for complex queries:

```typescript
class OrderRepository implements IExtendedRepository<Order> {
  async findBySpecification(spec: ISpecification<Order>): Promise<Order[]> {
    // Translate specification to query
    const query = this.specificationTranslator.translate(spec);
    
    // Execute query
    const results = await this.db.orders.find(query);
    
    // Map to domain objects
    return results.map(OrderMapper.toDomain);
  }
}
```

### 3. Transactional Consistency

Ensure all operations within save are transactional:

```typescript
async save(order: Order): Promise<void> {
  await this.db.transaction(async (tx) => {
    // Save order
    await tx.orders.upsert(orderData);
    
    // Save related data
    await tx.orderItems.upsertMany(itemsData);
    
    // Update inventory
    await tx.inventory.decrementMany(inventoryUpdates);
  });
}
```

### 4. Repository Interface Segregation

Create specific interfaces for different use cases:

```typescript
interface IReadOnlyOrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  findByCustomer(customerId: CustomerId): Promise<Order[]>;
}

interface IWriteOrderRepository {
  save(order: Order): Promise<void>;
  delete(order: Order): Promise<void>;
}
```

## Integration with DomainTS

### With Unit of Work

```typescript
const unitOfWork = new UnitOfWork();
const orderRepo = unitOfWork.getRepository<Order>('orders');

await unitOfWork.transaction(async () => {
  const order = await orderRepo.findById(orderId);
  order.ship();
  await orderRepo.save(order);
});
```

### With Domain Events

```typescript
class OrderRepository extends IBaseRepository {
  constructor(eventDispatcher: IEventDispatcher) {
    super(eventDispatcher);
  }
  
  // Events are automatically dispatched after save
}
```

### With Specifications

```typescript
const openOrdersSpec = new OpenOrdersSpecification();
const highValueSpec = new HighValueOrderSpecification(1000);
const combinedSpec = openOrdersSpec.and(highValueSpec);

const orders = await orderRepository.findBySpecification(combinedSpec);
```

## Error Handling

The repository pattern in DomainTS includes specific error types:

- `VersionError`: Thrown when concurrent modification is detected
- `Missing handler error`: Thrown when event handler is not implemented

```typescript
if (initialVersion !== currentVersion) {
  throw VersionError.withEntityIdAndVersions(
    aggregate.getId(),
    currentVersion,
    initialVersion
  );
}
```

## Conclusion

Repository Pattern in DomainTS provides:

- **Clean Abstraction**: Separates domain logic from persistence
- **Event Integration**: Automatic domain event handling
- **Concurrency Control**: Version checking for consistency
- **Flexibility**: Support for different persistence strategies
- **Type Safety**: Strong typing for aggregates and specifications

The pattern enables clean separation of concerns while maintaining consistency and supporting both traditional and event-sourced persistence approaches.
