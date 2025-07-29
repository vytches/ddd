# AggregateBuilder Class Methods

**Package**: `@vytches/ddd-aggregates`  
**Class**: `AggregateBuilder`  
**File**: `src/core/aggregate-root.builder.ts`

## Overview

The `AggregateBuilder` class provides a fluent API for creating `AggregateRoot` instances with various capabilities. It follows the Builder pattern to configure aggregates with specific features like snapshots, versioning, audit trails, and event sourcing.

## Static Methods

### `create<TId = string>(params: { id: TId | EntityId<TId>; version?: number }): AggregateBuilder<TId>`
- **Purpose**: Create a new builder instance to configure an aggregate
- **Parameters**:
  - `params.id`: The aggregate ID (string, number, or EntityId)
  - `params.version`: Optional initial version (default: 0)
- **Returns**: New `AggregateBuilder` instance
- **Example**: 
  ```typescript
  const builder = AggregateBuilder.create({ 
    id: 'user-123', 
    version: 1 
  });
  ```

## Builder Methods (Capabilities)

### `withSnapshots(): this`
- **Purpose**: Add snapshot capability to the aggregate
- **Returns**: `this` (for method chaining)
- **What it does**: Enables the aggregate to create and restore from snapshots
- **Example**: `builder.withSnapshots()`

### `withVersioning(): this`
- **Purpose**: Add versioning capability to the aggregate
- **Returns**: `this` (for method chaining)
- **What it does**: Enables optimistic concurrency control
- **Example**: `builder.withVersioning()`

### `withAudit(): this`
- **Purpose**: Add audit capability to the aggregate
- **Returns**: `this` (for method chaining)
- **What it does**: Enables audit trail tracking (who/when changes were made)
- **Example**: `builder.withAudit()`

### `withEventSourcing(eventStore?: IEventStore): this`
- **Purpose**: Add event sourcing capability to the aggregate
- **Parameters**: `eventStore` - Optional event store instance
- **Returns**: `this` (for method chaining)
- **What it does**: Enables event sourcing persistence and replay
- **Example**: `builder.withEventSourcing(myEventStore)`

### `withCapability<T extends Capability & IAggregateCapability>(capability: T, configure?: (cap: T) => void): this`
- **Purpose**: Add a custom capability to the aggregate
- **Parameters**:
  - `capability`: The capability instance to add
  - `configure`: Optional configuration function
- **Returns**: `this` (for method chaining)
- **Example**: 
  ```typescript
  builder.withCapability(
    new CustomCapability(), 
    (cap) => cap.setOption('value')
  )
  ```

## Build Methods

### `build(): AggregateRoot<TId>`
- **Purpose**: Create the final AggregateRoot instance with all configured capabilities
- **Returns**: Configured `AggregateRoot` instance
- **Example**: `const aggregate = builder.build();`

### `buildWithEventStore(eventStore: IEventStore): AggregateRoot<TId>`
- **Purpose**: Create the aggregate and set the event store for event sourcing
- **Parameters**: `eventStore` - The event store to use
- **Returns**: Configured `AggregateRoot` instance with event store
- **Example**: `const aggregate = builder.buildWithEventStore(eventStore);`

## Utility Function

### `aggregateBuilder<TId = string>(params: { id: TId | EntityId<TId>; version?: number }): AggregateBuilder<TId>`
- **Purpose**: Shorthand function for creating a builder (alternative to `AggregateBuilder.create()`)
- **Parameters**: Same as `AggregateBuilder.create()`
- **Returns**: New `AggregateBuilder` instance
- **Example**: `const builder = aggregateBuilder({ id: 'user-123' });`

## Usage Examples

### Basic Builder Usage

```typescript
import { AggregateBuilder, EntityId } from '@vytches/ddd-aggregates';

// Simple aggregate with versioning
const aggregate = AggregateBuilder
  .create({ id: EntityId.createWithRandomUUID() })
  .withVersioning()
  .build();
```

### Complex Aggregate with Multiple Capabilities

```typescript
import { AggregateBuilder, EntityId } from '@vytches/ddd-aggregates';
import { MyEventStore } from './my-event-store';

const eventStore = new MyEventStore();

const aggregate = AggregateBuilder
  .create({ 
    id: EntityId.fromText('user-12345'), 
    version: 0 
  })
  .withSnapshots()        // Enable snapshots
  .withVersioning()       // Enable optimistic concurrency
  .withAudit()           // Enable audit trail
  .withEventSourcing()   // Enable event sourcing
  .buildWithEventStore(eventStore);

// Now the aggregate has all capabilities
console.log(aggregate.hasCapability(SnapshotCapability)); // true
console.log(aggregate.hasCapability(VersioningCapability)); // true
```

### Using the Shorthand Function

```typescript
import { aggregateBuilder } from '@vytches/ddd-aggregates';

const aggregate = aggregateBuilder({ id: 'order-456' })
  .withSnapshots()
  .withVersioning()
  .build();
```

### Building Domain-Specific Aggregates

```typescript
class OrderAggregate extends AggregateRoot<string> {
  // ... order-specific implementation

  static createNew(customerId: string): OrderAggregate {
    // Create base aggregate with capabilities
    const baseAggregate = AggregateBuilder
      .create({ id: EntityId.createWithRandomUUID() })
      .withVersioning()
      .withAudit()
      .build();

    // Create domain-specific aggregate
    const order = new OrderAggregate({
      id: baseAggregate.getId(),
      version: baseAggregate.getVersion()
    });

    // Copy capabilities from builder result
    // ... capability transfer logic

    return order;
  }
}
```

## Method Chaining

All builder methods return `this`, allowing for fluent method chaining:

```typescript
const aggregate = AggregateBuilder
  .create({ id: 'product-789' })
  .withSnapshots()
  .withVersioning() 
  .withAudit()
  .withEventSourcing()
  .build();
```

## Notes

- Always call `build()` or `buildWithEventStore()` at the end to create the final aggregate
- Capabilities can be added in any order
- The builder validates that required dependencies are met (e.g., event sourcing needs an event store)
- Each capability adds specific methods and behaviors to the resulting aggregate
- Use `aggregateBuilder()` as a shorthand for `AggregateBuilder.create()`