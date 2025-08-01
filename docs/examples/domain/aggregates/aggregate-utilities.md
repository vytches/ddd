@global-settings
@strategy: merge
@description: Global description for all aggregate utility examples
@business-context: Standard business context for aggregate utility operations
@author: DDD Team
@since: 1.0.0
@global-settings-end

# AggregateUtilities - Advanced Example

**Version**: 1.0.0
**Package**: @vytches/ddd-aggregates
**Complexity**: advanced
**Domain**: aggregates
**Patterns**: type-guards, casting, capability-inspection
**Dependencies**: @vytches/ddd-contracts, @vytches/ddd-logging

## Description

Demonstrates aggregate utilities for type-safe capability management, including type guards, casting functions, and bulk operations. Shows how to work with capabilities in a type-safe manner.

## Business Context

Essential utilities for working with aggregate capabilities in enterprise applications. Enables type-safe capability checking, casting, and bulk processing operations that are crucial for complex domain scenarios.

## Code Example

@description: Demonstrates type-safe aggregate utility functions for capability management and bulk operations
@description.cli: ## Enhanced CLI Description\n\nShows comprehensive utility functions for capability inspection, type guards, and bulk processing
@description.jsdoc: Aggregate utility functions for type-safe capability management
@business-context: Enables type-safe capability operations in enterprise aggregate scenarios
@business-context.cli: Extended context for enterprise capability management patterns
@business-context.jsdoc: Type-safe utilities for aggregate capability management
@since: 1.0.0

@extract: aggregate-utils:domain:advanced

```typescript
import { AggregateBuilder } from '@vytches/ddd-aggregates';
import { 
  hasSnapshotCapability, 
  asSnapshotAggregate,
  getAggregateInfo,
  processAggregatesWithCapabilities 
} from '@vytches/ddd-aggregates';
import { EntityId } from '@vytches/ddd-contracts';

// Create aggregate with capabilities
const orderId = new EntityId('order-123', 'text');
const orderAggregate = AggregateBuilder
  .create({ id: orderId, version: 0 })
  .withSnapshots()
  .withAudit()
  .withVersioning()
  .build();

// Type-safe capability checking
if (hasSnapshotCapability(orderAggregate)) {
  // TypeScript knows this is AggregateWithSnapshotCapability
  const snapshotCapability = orderAggregate.getCapability(SnapshotCapability);
  
  // Create snapshot with serializer
  const snapshot = snapshotCapability?.createSnapshot(() => ({
    orderId: orderId.getValue(),
    items: [],
    total: 0,
    status: 'pending'
  }));
}

// Safe casting with error handling
try {
  const snapshotAggregate = asSnapshotAggregate(orderAggregate);
  // Now guaranteed to have snapshot capability
  console.log('Snapshot capability available');
} catch (error) {
  console.log('Snapshot capability not available');
}

// Get aggregate information
const info = getAggregateInfo(orderAggregate);
console.log('Aggregate info:', {
  id: info.id,
  type: info.type,
  version: info.version,
  capabilities: info.capabilities,
  hasChanges: info.hasChanges,
  events: info.events
});

// Bulk processing with capabilities
const aggregates = [orderAggregate /* ... more aggregates */];

await processAggregatesWithCapabilities(aggregates, {
  snapshot: (aggregate) => {
    // Process snapshot-capable aggregates
    const cap = aggregate.getCapability(SnapshotCapability);
    cap?.saveSnapshot(() => aggregate.getState());
  },
  
  audit: (aggregate) => {
    // Process audit-capable aggregates
    const cap = aggregate.getCapability(AuditCapability);
    const stats = cap?.getAuditStatistics();
    console.log('Audit stats:', stats);
  },
  
  eventSourcing: async (aggregate) => {
    // Process event sourcing aggregates
    const cap = aggregate.getCapability(EventSourcingCapability);
    if (cap?.hasEventStore()) {
      await cap.saveToEventStore();
    }
  }
});
```

@extract-end

## Key Features

- **Type Guards**: Runtime type checking with compile-time guarantees
- **Safe Casting**: Error-throwing casting functions for capability validation
- **Bulk Operations**: Process multiple aggregates with different capabilities
- **Information Extraction**: Get comprehensive aggregate metadata
- **Capability Inspection**: Check which capabilities are available

## Common Pitfalls

- Don't assume capabilities exist - always use type guards first
- Remember that `as*Aggregate` functions throw errors if capability is missing
- Use bulk operations for performance when processing many aggregates
- Capability type information is preserved through type guards

## Related Examples

- [AggregateRoot](./aggregate-root.md) - Basic aggregate implementation
- [AggregateBuilder](./aggregate-builder.md) - Builder pattern for aggregates
