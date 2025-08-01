# AggregateRoot Usage Patterns

**Version**: 1.0.0 
**Package**: @vytches/ddd-aggregates 
**Complexity**: Intermediate
**Domain**: Pattern 
**Patterns**: aggregate-pattern, event-sourcing, domain-events 
**Dependencies**: @vytches/ddd-contracts, @vytches/ddd-domain-primitives

## Description

AggregateRoot is the base class for all domain aggregates in the VytchesDDD library. It provides essential functionality for domain event management, versioning, and aggregate lifecycle operations following Domain-Driven Design patterns.

## Business Context

Aggregates are the primary building blocks of domain models, encapsulating business logic and maintaining consistency boundaries. AggregateRoot provides the foundation for event sourcing, domain event publishing, and aggregate state management in enterprise applications.

## Core AggregateRoot Implementation

@global-settings
@strategy: merge
@description: Base class for domain aggregates with event sourcing capabilities
@business-context: Foundation for implementing aggregate pattern in DDD applications
@author: DDD Team
@since: 1.0.0
@global-settings-end

### getId() - Aggregate Identification

@description: Get the aggregate's unique identifier
@description.cli: ## Get Aggregate ID\n\nRetrieves the unique EntityId assigned to this aggregate instance
@business-context: Essential for aggregate identification and persistence operations
@business-context.jsdoc: Used by repositories and event stores for aggregate identification

@extract: getId:domain:basic

```typescript
// Get the aggregate's unique identifier
const order = new OrderAggregate({ id: orderId, version: 0 });
const aggregateId = order.getId();
// Returns: EntityId<TId> instance for aggregate identification
```

@extract-end

### getVersion() - Concurrency Control

@description: Get the current version number of the aggregate
@description.cli: ## Get Aggregate Version\n\nRetrieves version number for optimistic concurrency control
@business-context: Critical for preventing concurrent modification conflicts
@business-context.jsdoc: Used for optimistic concurrency control in repositories

@extract: getVersion:domain:basic

```typescript
// Get current aggregate version for concurrency control
const order = new OrderAggregate({ id: orderId, version: 5 });
const currentVersion = order.getVersion();
// Returns: 5 (number) for version tracking
```

@extract-end

### getDomainEvents() - Event Retrieval

@description: Get readonly array of uncommitted domain events
@description.cli: ## Get Domain Events\n\nRetrieves all uncommitted domain events for persistence
@business-context: Used by repositories to retrieve events for publishing
@business-context.jsdoc: Core part of event sourcing pattern for repositories

@extract: getDomainEvents:domain:basic

```typescript
// Get uncommitted events for repository save
const order = new OrderAggregate({ id: orderId, version: 0 });
order.addItem(itemData); // Generates domain events

const events = order.getDomainEvents();
// Returns: ReadonlyArray with generated domain events
```

@extract-end

### hasChanges() - Change Detection

@description: Check if aggregate has uncommitted domain events
@description.cli: ## Check for Changes\n\nOptimization method to avoid unnecessary repository saves
@business-context: Used to optimize repository operations
@business-context.jsdoc: Performance optimization for conditional saves

@extract: hasChanges:domain:basic

```typescript
// Check for changes before expensive save operation
const order = await repository.findById(orderId);
order.updateStatus(newStatus); // May generate events

if (order.hasChanges()) {
  await repository.save(order); // Only save when needed
}
```

@extract-end

### commit() - Event Lifecycle

@description: Clear uncommitted domain events after successful persistence
@description.cli: ## Commit Events\n\nClears uncommitted events after successful repository save
@business-context: Completes the repository save transaction
@business-context.jsdoc: Called by repositories after successful event persistence

@extract: commit:domain:basic

```typescript
// Commit events after successful repository save
const order = new OrderAggregate({ id: orderId, version: 0 });
order.addItem(itemData); // Generates events

await repository.save(order); // Persists events
order.commit(); // Clears uncommitted events
```

@extract-end

### getInitialVersion() - Version Tracking

@description: Get the initial version when aggregate was loaded
@description.cli: ## Get Initial Version\n\nRetrieves the version number from when aggregate was first loaded
@business-context: Used for tracking version changes during aggregate lifecycle
@business-context.jsdoc: Useful for audit trails and change tracking in repositories

@extract: getInitialVersion:domain:basic

```typescript
// Get initial version for change tracking
const order = await repository.findById(orderId); // Loaded at version 5
order.updateStatus(newStatus); // Modifies to version 6

const initialVersion = order.getInitialVersion(); // Returns: 5
const currentVersion = order.getVersion(); // Returns: 6
```

@extract-end

### addCapability() - Capability Management

@description: Add a capability to enhance aggregate functionality
@description.cli: ## Add Capability\n\nExtends aggregate with additional capabilities like snapshots or auditing
@business-context: Enables modular aggregate enhancement based on business requirements
@business-context.jsdoc: Used to add cross-cutting concerns to aggregates

@extract: addCapability:domain:basic

```typescript
// Add snapshot capability to aggregate
const order = new OrderAggregate({ id: orderId, version: 0 });
const snapshotCapability = new SnapshotCapability();

order.addCapability(snapshotCapability);
// Returns: this (aggregate instance) for method chaining
```

@extract-end

### getCapability() - Capability Retrieval

@description: Retrieve a specific capability by its constructor
@description.cli: ## Get Capability\n\nRetrieves registered capability instance for use
@business-context: Allows accessing capability-specific functionality
@business-context.jsdoc: Used to interact with specific aggregate capabilities

@extract: getCapability:domain:basic

```typescript
// Get snapshot capability for creating snapshots
const order = new OrderAggregate({ id: orderId, version: 0 });
order.addCapability(new SnapshotCapability());

const snapshotCapability = order.getCapability(SnapshotCapability);
if (snapshotCapability) {
  const snapshot = snapshotCapability.createSnapshot();
}
```

@extract-end

### hasCapability() - Capability Detection

@description: Check if aggregate has a specific capability
@description.cli: ## Check Capability\n\nChecks if aggregate has registered a specific capability
@business-context: Used for conditional capability-based logic
@business-context.jsdoc: Prevents errors when checking for optional capabilities

@extract: hasCapability:domain:basic

```typescript
// Check if aggregate supports snapshots
const order = new OrderAggregate({ id: orderId, version: 0 });
order.addCapability(new SnapshotCapability());

if (order.hasCapability(SnapshotCapability)) {
  // Safe to use snapshot functionality
  const capability = order.getCapability(SnapshotCapability);
}
```

@extract-end

### removeCapability() - Capability Removal

@description: Remove a capability from the aggregate
@description.cli: ## Remove Capability\n\nRemoves registered capability and calls its detach method
@business-context: Used for dynamic capability management
@business-context.jsdoc: Properly cleans up capability resources

@extract: removeCapability:domain:basic

```typescript
// Remove audit capability when no longer needed
const order = new OrderAggregate({ id: orderId, version: 0 });
order.addCapability(new AuditCapability());

order.removeCapability(AuditCapability);
// Capability is removed and detached properly
```

@extract-end

### getAllCapabilities() - Capability Listing

@description: Get array of all registered capabilities
@description.cli: ## Get All Capabilities\n\nRetrieves list of all capabilities for inspection
@business-context: Used for debugging and capability introspection
@business-context.jsdoc: Provides access to all registered capabilities

@extract: getAllCapabilities:domain:basic

```typescript
// Get all capabilities for debugging
const order = new OrderAggregate({ id: orderId, version: 0 });
order.addCapability(new SnapshotCapability());
order.addCapability(new AuditCapability());

const capabilities = order.getAllCapabilities();
// Returns: Capability[] with both registered capabilities
```

@extract-end

### getCapabilityTypes() - Type Inspection

@description: Get array of capability type names
@description.cli: ## Get Capability Types\n\nRetrieves string names of all registered capability types
@business-context: Used for logging and capability discovery
@business-context.jsdoc: Provides string names for capability identification

@extract: getCapabilityTypes:domain:basic

```typescript
// Get capability type names for logging
const order = new OrderAggregate({ id: orderId, version: 0 });
order.addCapability(new SnapshotCapability());
order.addCapability(new AuditCapability());

const types = order.getCapabilityTypes();
// Returns: ['SnapshotCapability', 'AuditCapability']
```

@extract-end

## Advanced Usage Patterns

### Event Sourcing Integration

@description: Integration with event sourcing repositories
@business-context: Full event sourcing workflow with aggregate reconstruction

@extract: event-sourcing:domain:intermediate

```typescript
// Event sourcing repository integration
class EventSourcedOrderRepository {
  async save(aggregate: OrderAggregate): Promise<void> {
    const events = aggregate.getDomainEvents();
    const version = aggregate.getVersion();
    
    // Persist events with version check
    await this.eventStore.saveEvents(aggregate.getId(), events, version);
    
    // Publish events to event bus
    await this.eventBus.publishMany(events);
    
    // Complete transaction
    aggregate.commit();
  }
  
  async findById(id: EntityId): Promise<OrderAggregate> {
    const events = await this.eventStore.getEvents(id);
    const aggregate = new OrderAggregate({ id, version: 0 });
    aggregate.loadFromHistory(events);
    return aggregate;
  }
}
```

@extract-end

### Capability System Integration

@description: Working with aggregate capabilities
@business-context: Extending aggregates with additional capabilities

@extract: capabilities:domain:advanced

```typescript
// Using aggregate capabilities system
const order = new OrderAggregate({ id: orderId, version: 0 });

// Add versioning capability
order.addCapability(new VersioningCapability());

// Add snapshot capability
order.addCapability(new SnapshotCapability());

// Check available capabilities
const capabilities = order.getAllCapabilities();
const hasVersioning = order.getCapabilityTypes().includes('versioning');
```

@extract-end

### Protected Method Usage

### registerEventHandler() - Event Handler Registration

@description: Register an event handler for specific event types
@description.cli: ## Register Event Handler\n\nRegisters internal event handler for aggregate state updates
@business-context: Used internally by aggregates to handle their own events
@business-context.jsdoc: Foundation for event-driven aggregate state management

@extract: registerEventHandler:domain:intermediate

```typescript
// Register handler for order item added events
class OrderAggregate extends AggregateRoot<string> {
  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
    
    // Register event handlers for state management
    this.registerEventHandler('OrderItemAdded', this.onOrderItemAdded.bind(this));
    this.registerEventHandler('OrderStatusChanged', this.onOrderStatusChanged.bind(this));
  }
  
  private onOrderItemAdded(payload: any, metadata: IEventMetadata): void {
    // Update aggregate state based on event
  }
}
```

@extract-end

### apply() - Event Application

@description: Apply domain event and update aggregate state
@description.cli: ## Apply Domain Event\n\nApplies event to aggregate and triggers state update handlers
@business-context: Core method for event sourcing pattern implementation
@business-context.jsdoc: Foundation for all domain business logic actions

@extract: apply:domain:intermediate

```typescript
// Apply domain event within aggregate method
class OrderAggregate extends AggregateRoot<string> {
  addItem(itemData: OrderItemData): void {
    // Business validation logic
    if (!this.canAddItem(itemData)) {
      throw new Error('Cannot add item to order');
    }
    
    // Apply domain event - this updates state and queues event
    this.apply('OrderItemAdded', itemData, {
      userId: itemData.userId,
      timestamp: new Date().toISOString()
    });
  }
}
```

@extract-end

### loadFromHistory() - Event Replay

@description: Reconstruct aggregate state from historical events
@description.cli: ## Load From History\n\nReplays events to reconstruct aggregate state for event sourcing
@business-context: Essential for event sourcing repositories
@business-context.jsdoc: Used by repositories to rebuild aggregates from events

@extract: loadFromHistory:domain:intermediate

```typescript
// Reconstruct aggregate from event history
class EventSourcedRepository {
  async findById(id: EntityId): Promise<OrderAggregate> {
    const events = await this.eventStore.getEvents(id);
    
    const aggregate = new OrderAggregate({ id, version: 0 });
    
    // Reconstruct state from events
    aggregate.loadFromHistory(events);
    
    return aggregate;
  }
}
```

@extract-end

## Key Features

- **Event Management**: Automatic domain event collection and lifecycle management
- **Version Control**: Built-in optimistic concurrency control with version tracking
- **Capability System**: Extensible architecture for adding aggregate capabilities
- **Type Safety**: Generic TId parameter for type-safe identifier handling
- **Event Sourcing**: Full integration with event sourcing patterns and repositories

## Common Pitfalls

- Don't call `commit()` before successfully persisting events - this will lose events permanently
- Always check `hasChanges()` before expensive repository operations for performance
- Don't modify the array returned by `getDomainEvents()` - it's readonly for consistency
- Version numbers start at 0 for new aggregates and are managed automatically

## Related Examples

- [AggregateBuilder](./aggregate-builder.md) - Builder pattern for aggregate construction
- [EntityId Usage](../contracts/entity-id-usage.md) - Working with aggregate identifiers
- [Repository Patterns](../repositories/base-repository.md) - Persisting aggregates
