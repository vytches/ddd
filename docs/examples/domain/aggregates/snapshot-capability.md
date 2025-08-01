@global-settings
@strategy: merge
@description: Global description for all aggregate capability examples
@business-context: Standard business context for aggregate capability operations
@author: DDD Team
@since: 1.0.0
@global-settings-end

# SnapshotCapability - Advanced Example

**Version**: 1.0.0
**Package**: @vytches/ddd-aggregates
**Complexity**: advanced
**Domain**: aggregates
**Patterns**: snapshots, state-management, performance-optimization
**Dependencies**: @vytches/ddd-contracts

## Description

Demonstrates snapshot capability for aggregate state persistence and restoration. Shows how to optimize performance by saving aggregate state at specific points in time.

## Business Context

Snapshots are crucial for performance in event-sourced systems. Instead of replaying hundreds of events, you can restore from the latest snapshot and only replay subsequent events.

## Code Example

@description: Demonstrates snapshot capability for performance optimization through state persistence and restoration
@description.cli: ## Enhanced CLI Description\n\nShows state snapshots for event-sourced aggregates to optimize performance
@description.jsdoc: Snapshot capability for aggregate state persistence and restoration
@business-context: Optimizes event-sourced aggregate performance through strategic state snapshots
@business-context.cli: Extended context for enterprise snapshot performance optimization patterns
@business-context.jsdoc: Performance optimization through aggregate state snapshots
@since: 1.0.0

@extract: snapshot-capability:domain:advanced

```typescript
import { AggregateBuilder, SnapshotCapability } from '@vytches/ddd-aggregates';
import { EntityId } from '@vytches/ddd-contracts';

// Define aggregate state interface
interface OrderState {
  orderId: string;
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered';
  createdAt: Date;
  updatedAt: Date;
}

// Define snapshot metadata
interface OrderSnapshotMetadata {
  processingNode: string;
  snapshotReason: string;
  itemCount: number;
}

class OrderAggregate extends AggregateRoot<string> {
  private state: OrderState;

  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
    
    this.state = {
      orderId: params.id.getValue(),
      customerId: '',
      items: [],
      total: 0,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Business methods
  addItem(productId: string, quantity: number, price: number): void {
    this.state.items.push({ productId, quantity, price });
    this.state.total += quantity * price;
    this.state.updatedAt = new Date();
    
    // Add domain event
    this.addDomainEvent(new OrderItemAddedEvent({
      orderId: this.state.orderId,
      productId,
      quantity,
      price
    }));
  }

  confirmOrder(): void {
    this.state.status = 'confirmed';
    this.state.updatedAt = new Date();
    
    this.addDomainEvent(new OrderConfirmedEvent({
      orderId: this.state.orderId,
      total: this.state.total
    }));
  }

  // State accessor for snapshots
  getState(): OrderState {
    return { ...this.state };
  }

  // State restoration for snapshots
  restoreState(state: OrderState): void {
    this.state = { ...state };
  }
}

// Create aggregate with snapshot capability
function createOrderWithSnapshots() {
  const orderId = new EntityId('order-123', 'text');
  
  const orderAggregate = AggregateBuilder
    .create({ id: orderId, version: 0 })
    .withSnapshots<OrderState, OrderSnapshotMetadata>()
    .build(OrderAggregate);

  return orderAggregate;
}

// Demonstrate snapshot operations
async function demonstrateSnapshotOperations() {
  const order = createOrderWithSnapshots();
  
  // Build up some state
  order.addItem('product-1', 2, 10.00);
  order.addItem('product-2', 1, 25.00);
  order.confirmOrder();

  // Get snapshot capability
  const snapshotCap = order.getCapability(SnapshotCapability);
  if (!snapshotCap) {
    throw new Error('Snapshot capability not available');
  }

  // Create snapshot with custom serializer and metadata
  const snapshot = snapshotCap.createSnapshot(
    // State serializer
    () => order.getState(),
    
    // Metadata creator
    () => ({
      processingNode: 'node-1',
      snapshotReason: 'periodic_save',
      itemCount: order.getState().items.length
    })
  );

  console.log('Snapshot created:', {
    aggregateId: snapshot.aggregateId,
    version: snapshot.version,
    aggregateType: snapshot.aggregateType,
    timestamp: snapshot.timestamp,
    metadata: snapshot.metadata
  });

  // Save snapshot for later restoration
  snapshotCap.saveSnapshot(
    () => order.getState(),
    () => ({
      processingNode: 'node-1', 
      snapshotReason: 'manual_save',
      itemCount: order.getState().items.length
    })
  );

  // Create new aggregate instance
  const newOrder = createOrderWithSnapshots();
  const newSnapshotCap = newOrder.getCapability(SnapshotCapability);

  // Restore from snapshot
  newSnapshotCap?.restoreFromSnapshot(
    snapshot,
    
    // State deserializer
    (state: OrderState) => {
      newOrder.restoreState(state);
    },
    
    // Metadata restorer
    (metadata: OrderSnapshotMetadata) => {
      console.log('Restored with metadata:', {
        processingNode: metadata.processingNode,
        snapshotReason: metadata.snapshotReason,
        itemCount: metadata.itemCount
      });
    }
  );

  console.log('Aggregate restored from snapshot:', {
    id: newOrder.getId().getValue(),
    version: newOrder.getVersion(),
    state: newOrder.getState()
  });

  return { original: order, restored: newOrder };
}

// Advanced snapshot management
async function advancedSnapshotManagement() {
  const order = createOrderWithSnapshots();
  const snapshotCap = order.getCapability(SnapshotCapability);

  // Build up state over time
  for (let i = 0; i < 10; i++) {
    order.addItem(`product-${i}`, 1, 10.00);
    
    // Create snapshot every 3 items for performance
    if (i % 3 === 0) {
      snapshotCap?.saveSnapshot(
        () => order.getState(),
        () => ({
          processingNode: 'batch-processor',
          snapshotReason: 'batch_interval',
          itemCount: order.getState().items.length
        })
      );
    }
  }

  // Get the most recent snapshot
  const previousState = snapshotCap?.getPreviousState();
  if (previousState) {
    console.log('Last snapshot timestamp:', previousState.timestamp);
    console.log('Snapshot metadata:', previousState.metadata);
  }

  return order;
}

// Error handling with snapshots
function handleSnapshotErrors() {
  const order = createOrderWithSnapshots();
  const snapshotCap = order.getCapability(SnapshotCapability);

  try {
    // Invalid snapshot (different aggregate ID)
    const invalidSnapshot = {
      aggregateId: 'different-order-456',
      version: 1,
      aggregateType: 'OrderAggregate',
      state: { /* invalid state */ },
      timestamp: new Date()
    };

    snapshotCap?.restoreFromSnapshot(
      invalidSnapshot as any,
      (state: OrderState) => order.restoreState(state)
    );
  } catch (error) {
    console.log('Snapshot restoration failed:', error.message);
    // Handle ID mismatch, type mismatch, or invalid snapshot errors
  }
}
```

@extract-end

## Key Features

- **Custom Serialization**: Define how aggregate state is serialized for snapshots
- **Metadata Support**: Include additional context in snapshot metadata
- **State Restoration**: Type-safe state restoration from snapshots
- **Performance Optimization**: Reduce event replay overhead
- **Validation**: Automatic validation of snapshot integrity

## Common Pitfalls

- Ensure state serialization captures all necessary data
- Handle version compatibility when restoring old snapshots
- Validate snapshot integrity before restoration
- Consider memory usage when storing snapshot state

## Related Examples

- [AggregateRoot](./aggregate-root.md) - Basic aggregate implementation
- [EventSourcingCapability](./event-sourcing-capability.md) - Event sourcing integration
