# AggregateBuilder Usage Patterns

**Version**: 1.0.0 
**Package**: @vytches/ddd-aggregates
**Complexity**: Intermediate
**Domain**: Pattern
**Patterns**: builder-pattern, aggregate-pattern, capability-system
**Dependencies**: @vytches/ddd-contracts, @vytches/ddd-domain-primitives

## Description

AggregateBuilder provides a fluent builder pattern for constructing aggregates with capabilities in the VytchesDDD library. It enables clean, composable aggregate configuration with support for snapshots, versioning, audit trails, event sourcing, and custom capabilities.

## Business Context

Complex aggregates often require various capabilities like snapshotting for performance, versioning for concurrency control, and audit trails for compliance. AggregateBuilder provides a clean, testable way to configure these capabilities without polluting aggregate constructors with configuration complexity.

## Core AggregateBuilder Implementation

@global-settings
@strategy: merge
@description: Fluent builder for configuring aggregates with capabilities
@business-context: Simplifies aggregate construction with composable capability configuration
@author: DDD Team
@since: 1.0.0
@global-settings-end

### create() - Builder Initialization

@description: Creates a new AggregateBuilder instance with the specified EntityId and version
@description.jsdoc: Creates AggregateBuilder instance for fluent aggregate configuration
@business-context: Entry point for building aggregates with type-safe capability composition
@business-context.jsdoc: Factory method for aggregate builder initialization with EntityId
@strategy: merge
@since: 1.0.0

@extract: create:domain:basic

```typescript
// Create builder with EntityId
const entityId = EntityId.createWithRandomUUID();
const builder = AggregateBuilder.create({
  id: entityId,
  version: 0
});
// Returns: AggregateBuilder instance ready for capability configuration
```

@extract-end

### withSnapshots() - Snapshot Capability

@extract: withSnapshots:domain:basic

```typescript
// Add snapshot capability for performance
const builder = AggregateBuilder.create({ id: orderId, version: 0 })
  .withSnapshots();

const aggregate = builder.build();
// Returns: Builder with snapshot capability configured
```

@extract-end

### withVersioning() - Versioning Capability

@extract: withVersioning:domain:basic

```typescript
// Add versioning for concurrency control
const builder = AggregateBuilder.create({ id: orderId, version: 0 })
  .withVersioning();

const aggregate = builder.build();
// Returns: Builder with versioning capability configured
```

@extract-end

### withAudit() - Audit Capability

@extract: withAudit:domain:basic

```typescript
// Add audit capability for compliance
const builder = AggregateBuilder.create({ id: orderId, version: 0 })
  .withAudit();

const aggregate = builder.build();
// Returns: Builder with audit capability configured
```

@extract-end

### withEventSourcing() - Event Sourcing Capability

@extract: withEventSourcing:domain:intermediate

```typescript
// Add event sourcing with event store
const eventStore = new InMemoryEventStore();
const builder = AggregateBuilder.create({ id: orderId, version: 0 })
  .withEventSourcing(eventStore);

const aggregate = builder.build();
// Returns: Builder with event sourcing capability and configured store
```

@extract-end

### withCapability() - Custom Capabilities

@description: Adds a custom capability to the aggregate with optional configuration
@description.jsdoc: Adds custom capability with type-safe configuration callback
@business-context: Enables extending aggregates with custom behaviors and configurations
@business-context.jsdoc: Generic method for adding enterprise-specific capabilities
@strategy: merge
@since: 1.0.0

@extract: withCapability:domain:advanced

```typescript
// Add custom capability with configuration
class SecurityCapability implements IAggregateCapability {
  configure(aggregate: AggregateRoot): void {
    // Custom security configuration
  }
}

const securityCap = new SecurityCapability();
const builder = AggregateBuilder.create({ id: orderId, version: 0 })
  .withCapability(securityCap, (cap) => {
    // Custom configuration logic
    cap.enableEncryption = true;
  });

const aggregate = builder.build();
// Returns: Builder with custom capability configured
```

@extract-end

### setEventStore() - Event Store Configuration

@extract: setEventStore:domain:intermediate

```typescript
// Configure event store for builder
const eventStore = new PostgreSQLEventStore(connectionConfig);
const builder = AggregateBuilder.create({ id: orderId, version: 0 })
  .setEventStore(eventStore)
  .withEventSourcing();

const aggregate = builder.build();
// Returns: Builder with configured event store
```

@extract-end

### build() - Aggregate Construction

@description: Constructs the final aggregate with all configured capabilities
@description.jsdoc: Builds aggregate instance with configured capabilities applied
@business-context: Final step in aggregate construction, applying all capabilities in order
@business-context.jsdoc: Finalizes aggregate creation with capability composition
@strategy: merge
@since: 1.0.0

@extract: build:domain:basic

```typescript
// Build aggregate with custom class
class OrderAggregate extends AggregateRoot {
  processPayment(amount: number) {
    // Business logic
  }
}

const aggregate = AggregateBuilder.create({ id: orderId, version: 0 })
  .withSnapshots()
  .withVersioning()
  .build(OrderAggregate);

// Returns: OrderAggregate instance with configured capabilities
```

@extract-end

### buildWithAllCapabilities() - Complete Configuration

@extract: buildWithAllCapabilities:domain:intermediate

```typescript
// Build aggregate with all standard capabilities
const fullAggregate = AggregateBuilder.create({ id: orderId, version: 0 })
  .buildWithAllCapabilities(OrderAggregate);

// Equivalent to:
// .withSnapshots()
// .withVersioning()
// .withAudit()
// .withEventSourcing()
// .build(OrderAggregate)
```

@extract-end

## Advanced Usage Patterns

### Capability Composition

@extract: capability-composition:domain:advanced

```typescript
// Complex capability configuration
const enterpriseAggregate = AggregateBuilder.create({ id: orderId, version: 0 })
  .setEventStore(eventStore)
  .withEventSourcing()
  .withSnapshots()
  .withVersioning()
  .withAudit()
  .withCapability(new SecurityCapability())
  .withCapability(new CachingCapability(), cap => {
    cap.ttl = 300000; // 5 minutes
    cap.maxSize = 1000;
  })
  .build(OrderAggregate);

// Returns: Fully configured enterprise aggregate
```

@extract-end

### Conditional Capability Building

@extract: conditional-building:domain:advanced

```typescript
// Environment-specific capability configuration
function createOrderAggregate(orderId: EntityId, environment: string): OrderAggregate {
  let builder = AggregateBuilder.create({ id: orderId, version: 0 })
    .withVersioning(); // Always include versioning

  // Production-specific capabilities
  if (environment === 'production') {
    builder = builder
      .withSnapshots()
      .withAudit()
      .withEventSourcing(productionEventStore);
  }

  // Development-specific capabilities
  if (environment === 'development') {
    builder = builder
      .withCapability(new DebuggingCapability());
  }

  return builder.build(OrderAggregate);
}
```

@extract-end

### aggregateBuilder() - Factory Function

@description: Convenience factory function for creating AggregateBuilder instances
@description.jsdoc: Factory function providing concise syntax for AggregateBuilder creation
@business-context: Shorthand syntax for creating aggregate builders in functional style
@business-context.jsdoc: Functional approach to aggregate builder instantiation
@strategy: merge
@since: 1.0.0

@extract: factory-function:domain:basic

```typescript
// Using factory function for concise syntax
import { aggregateBuilder } from '@vytches/ddd-aggregates';

const aggregate = aggregateBuilder({ id: orderId, version: 0 })
  .withSnapshots()
  .withVersioning()
  .build(OrderAggregate);

// Equivalent to AggregateBuilder.create() but more concise
```

@extract-end

## Key Features

- **Fluent Interface**: Chainable method calls for clean aggregate configuration
- **Type Safety**: Generic type parameters ensure type-safe aggregate construction
- **Capability System**: Modular capability addition with configuration callbacks
- **Flexible Construction**: Support for custom aggregate classes and standard AggregateRoot
- **Event Store Integration**: Built-in support for event sourcing with configurable stores
- **Convenience Methods**: Quick configuration with buildWithAllCapabilities()

## Common Pitfalls

- Don't call `build()` multiple times on the same builder - create new builders for each aggregate
- Always configure event store before adding event sourcing capability if using custom store
- Remember that capabilities are applied in the order they're added to the builder
- Custom capabilities must implement IAggregateCapability interface properly

## Related Examples

- [AggregateRoot](./aggregate-root.md) - Base aggregate functionality and methods
- [EntityId Usage](../contracts/entity-id-usage.md) - Working with aggregate identifiers
- [Event Sourcing](../events/event-sourcing.md) - Event sourcing patterns and stores
