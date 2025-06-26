# Domain Events in DomainTS - LLM-Optimized Guide

## Document Metadata

- **Pattern Name**: Domain Events
- **Category**: Domain-Driven Design (DDD) Pattern
- **Purpose**: Capture and communicate important domain occurrences
- **Library**: DomainTS
- **Language**: TypeScript
- **Version**: 1.0.0

## Pattern Overview

### What are Domain Events?

Domain Events represent something important that happened in the domain. They are immutable records of past occurrences that other parts of the system might need to know about.

**Core Concept**:
```typescript
// Create an event when something happens
const event = createDomainEvent('OrderPlaced', {
  orderId: '123',
  customerId: '456',
  totalAmount: 100.00
});

// Or use a typed event class
class OrderPlacedEvent extends DomainEvent<{ orderId: string; customerId: string }> {
  constructor(payload: { orderId: string; customerId: string }) {
    super(payload);
  }
}
```

## Core Components

### 1. Domain Event Interfaces

**IDomainEvent**: Basic event structure
```typescript
interface IDomainEvent<P = any> {
  eventType: string;      // What happened
  payload?: P;            // Event data
}
```

**IExtendedDomainEvent**: Event with metadata
```typescript
interface IExtendedDomainEvent<P = any> extends IDomainEvent<P> {
  metadata?: IEventMetadata;
}
```

**IEventMetadata**: Contextual information
```typescript
interface IEventMetadata {
  eventId?: string;               // Unique event identifier
  timestamp?: Date;               // When it occurred
  correlationId?: string;         // Track related operations
  causationId?: string;           // What caused this event
  aggregateId?: string | number;  // Source aggregate
  aggregateType?: string;         // Type of aggregate
  aggregateVersion?: number;      // Aggregate version after event
  eventVersion?: number;          // Event schema version
  userId?: string;                // Who triggered it
  [key: string]: any;            // Additional metadata
}
```

### 2. DomainEvent Abstract Class

Base implementation for typed domain events:

```typescript
abstract class DomainEvent<T = any> implements IExtendedDomainEvent<T> {
  readonly eventId: string;        // Auto-generated UUID
  readonly occurredOn: Date;       // Auto-set timestamp
  readonly eventType: string;      // Defaults to class name
  readonly payload?: T;
  readonly metadata?: IEventMetadata;
  
  constructor(payload?: T, metadata?: IEventMetadata);
  
  // Create copy with additional metadata
  withMetadata(metadata: Partial<IEventMetadata>): DomainEvent<T>;
}
```

### 3. Event Creation Utilities

Factory function for creating events:

```typescript
function createDomainEvent<P = any>(
  eventType: string,
  payload: P,
  metadata?: Partial<IEventMetadata>
): IExtendedDomainEvent<P>
```

## Usage Patterns

### 1. Creating Typed Event Classes

```typescript
class CustomerRegisteredEvent extends DomainEvent<{
  customerId: string;
  email: string;
  registeredAt: Date;
}> {
  constructor(payload: {
    customerId: string;
    email: string;
    registeredAt: Date;
  }) {
    super(payload);
  }
}

// Usage
const event = new CustomerRegisteredEvent({
  customerId: '123',
  email: 'user@example.com',
  registeredAt: new Date()
});
```

### 2. Using the Factory Function

```typescript
// Quick event creation
const event = createDomainEvent('ProductAddedToCart', {
  productId: 'prod-123',
  quantity: 2,
  cartId: 'cart-456'
});

// With additional metadata
const eventWithMeta = createDomainEvent(
  'PaymentProcessed',
  { orderId: 'order-789', amount: 99.99 },
  { 
    correlationId: 'session-123',
    userId: 'user-456'
  }
);
```

### 3. Adding Metadata to Events

```typescript
const originalEvent = new OrderShippedEvent({ orderId: '123' });

// Add correlation for tracking
const correlatedEvent = originalEvent.withMetadata({
  correlationId: 'batch-456',
  causationId: originalEvent.eventId
});
```

### 4. Event Versioning

Support for event schema evolution:

```typescript
const versionedEvent = createDomainEvent(
  'CustomerUpdated',
  { customerId: '123', name: 'John Doe' },
  { eventVersion: 2 }
);
```

## Key Concepts

### Event Metadata

Metadata provides context and enables advanced patterns:

- **eventId**: Unique identifier for deduplication
- **correlationId**: Track related events across services
- **causationId**: Trace event chains
- **aggregateId/Type/Version**: Source tracking
- **eventVersion**: Schema evolution support

### Event Naming

Use past tense to indicate something has happened:
- ✅ OrderPlaced, PaymentProcessed, CustomerRegistered
- ❌ PlaceOrder, ProcessPayment, RegisterCustomer

### Immutability

Events are immutable records:
```typescript
// Create new event with metadata, don't modify original
const newEvent = originalEvent.withMetadata({ userId: '123' });
```

## Integration with DomainTS

Domain Events integrate with:

- **Aggregates**: Emit events on state changes
- **Event Bus**: Publish events to handlers
- **Event Store**: Persist events for event sourcing
- **Integration Events**: Transform to cross-boundary events

## Best Practices

1. **Keep Events Small**: Include only necessary data
2. **Use Meaningful Names**: Clear, past-tense event names
3. **Version from Start**: Include eventVersion for future evolution
4. **Include Context**: Use metadata for tracing and correlation
5. **Make Events Self-Contained**: Include all needed information

## Example: Order Processing

```typescript
// Define domain events
class OrderPlacedEvent extends DomainEvent<{
  orderId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number }>;
  totalAmount: number;
}> {}

class PaymentProcessedEvent extends DomainEvent<{
  orderId: string;
  paymentId: string;
  amount: number;
  paymentMethod: string;
}> {}

class OrderShippedEvent extends DomainEvent<{
  orderId: string;
  trackingNumber: string;
  carrier: string;
}> {}

// Use in aggregate
class Order extends AggregateRoot<string> {
  placeOrder(customerId: string, items: OrderItem[]) {
    // Apply domain event
    this.apply(new OrderPlacedEvent({
      orderId: this.getId().getValue(),
      customerId,
      items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      totalAmount: this.calculateTotal(items)
    }));
  }
}
```

## Conclusion

DomainTS Domain Events provide:

- **Type Safety**: Strongly typed event payloads
- **Rich Metadata**: Comprehensive event context
- **Immutability**: Safe event records
- **Flexibility**: Both class-based and factory approaches
- **Integration Ready**: Works with event buses and stores

This implementation enables event-driven architectures while maintaining clean domain models and supporting advanced patterns like event sourcing and distributed tracing.
