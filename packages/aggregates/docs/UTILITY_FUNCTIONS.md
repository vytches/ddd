# Aggregate Utility Functions

**Package**: `@vytches/ddd-aggregates`  
**File**: `src/core/aggregate-utilities.ts`

## Overview

This module provides utility functions and type helpers for working with aggregates that have specific capabilities. These functions allow you to safely cast aggregates to their capability-enhanced types and check for capability support.

## Type Guards & Casting Functions

### `asSnapshotAggregate<T>(aggregate: T): AggregateWithSnapshotCapability<T> | null`
- **Purpose**: Safely cast an aggregate to one with snapshot capability
- **Parameters**: `aggregate` - The aggregate to check and cast
- **Returns**: The aggregate cast to snapshot type, or `null` if capability not present
- **Example**:
  ```typescript
  const snapshotAggregate = asSnapshotAggregate(myAggregate);
  if (snapshotAggregate) {
    const snapshot = snapshotAggregate.createSnapshot();
  }
  ```

### `asVersioningAggregate<T>(aggregate: T): AggregateWithVersioningCapability<T> | null`
- **Purpose**: Safely cast an aggregate to one with versioning capability
- **Parameters**: `aggregate` - The aggregate to check and cast
- **Returns**: The aggregate cast to versioning type, or `null` if capability not present
- **Example**:
  ```typescript
  const versioningAggregate = asVersioningAggregate(myAggregate);
  if (versioningAggregate) {
    versioningAggregate.incrementVersion();
  }
  ```

### `asAuditAggregate<T>(aggregate: T): AggregateWithAuditCapability<T> | null`
- **Purpose**: Safely cast an aggregate to one with audit capability
- **Parameters**: `aggregate` - The aggregate to check and cast
- **Returns**: The aggregate cast to audit type, or `null` if capability not present
- **Example**:
  ```typescript
  const auditAggregate = asAuditAggregate(myAggregate);
  if (auditAggregate) {
    const auditTrail = auditAggregate.getAuditTrail();
  }
  ```

### `asEventSourcingAggregate<T>(aggregate: T): AggregateWithEventSourcingCapability<T> | null`
- **Purpose**: Safely cast an aggregate to one with event sourcing capability
- **Parameters**: `aggregate` - The aggregate to check and cast
- **Returns**: The aggregate cast to event sourcing type, or `null` if capability not present
- **Example**:
  ```typescript
  const eventSourcingAggregate = asEventSourcingAggregate(myAggregate);
  if (eventSourcingAggregate) {
    await eventSourcingAggregate.replayEvents();
  }
  ```

## Capability Inspection Functions

### `getAggregateCapabilities(aggregate: IAggregateRoot): string[]`
- **Purpose**: Get a list of all capability names present on an aggregate
- **Parameters**: `aggregate` - The aggregate to inspect
- **Returns**: Array of capability names
- **Example**:
  ```typescript
  const capabilities = getAggregateCapabilities(myAggregate);
  console.log(capabilities); // ['SnapshotCapability', 'VersioningCapability']
  ```

### `hasAllCapabilities(aggregate: IAggregateRoot, ...capabilityTypes: CapabilityConstructor[]): boolean`
- **Purpose**: Check if an aggregate has all specified capabilities
- **Parameters**: 
  - `aggregate` - The aggregate to check
  - `...capabilityTypes` - Variable number of capability constructors to check for
- **Returns**: `true` if all capabilities are present, `false` otherwise
- **Example**:
  ```typescript
  import { SnapshotCapability, VersioningCapability } from '@vytches/ddd-aggregates';
  
  const hasRequired = hasAllCapabilities(
    myAggregate, 
    SnapshotCapability, 
    VersioningCapability
  );
  
  if (hasRequired) {
    // Safe to use both snapshot and versioning features
  }
  ```

## Helper Functions

### `createSnapshotIfCapable<TState>(aggregate: IAggregateRoot, serializer?: () => unknown, metadataCreator?: () => object): IAggregateSnapshot<TState> | null`
- **Purpose**: Create a snapshot if the aggregate has snapshot capability
- **Parameters**:
  - `aggregate` - The aggregate to snapshot
  - `serializer` - Optional custom serialization function
  - `metadataCreator` - Optional metadata creation function
- **Returns**: Snapshot object or `null` if capability not present
- **Example**:
  ```typescript
  const snapshot = createSnapshotIfCapable(
    myAggregate,
    () => ({ state: 'serialized' }),
    () => ({ timestamp: Date.now() })
  );
  
  if (snapshot) {
    // Save snapshot to storage
    await snapshotStore.save(snapshot);
  }
  ```

## Type Definitions

### `AggregateWithSnapshotCapability<T>`
Type representing an aggregate enhanced with snapshot capability methods.

### `AggregateWithVersioningCapability<T>` 
Type representing an aggregate enhanced with versioning capability methods.

### `AggregateWithAuditCapability<T>`
Type representing an aggregate enhanced with audit capability methods.

### `AggregateWithEventSourcingCapability<T>`
Type representing an aggregate enhanced with event sourcing capability methods.

## Usage Examples

### Safe Capability Usage Pattern

```typescript
import { 
  asSnapshotAggregate, 
  asVersioningAggregate,
  getAggregateCapabilities 
} from '@vytches/ddd-aggregates';

function processAggregate(aggregate: IAggregateRoot) {
  // Check what capabilities are available
  const capabilities = getAggregateCapabilities(aggregate);
  console.log('Available capabilities:', capabilities);

  // Safely use snapshot capability if available
  const snapshotAggregate = asSnapshotAggregate(aggregate);
  if (snapshotAggregate) {
    const snapshot = snapshotAggregate.createSnapshot();
    console.log('Snapshot created:', snapshot);
  }

  // Safely use versioning capability if available
  const versioningAggregate = asVersioningAggregate(aggregate);
  if (versioningAggregate) {
    console.log('Current version:', versioningAggregate.getVersion());
    versioningAggregate.incrementVersion();
  }
}
```

### Capability Requirements Check

```typescript
import { 
  hasAllCapabilities,
  SnapshotCapability,
  VersioningCapability 
} from '@vytches/ddd-aggregates';

function advancedProcessing(aggregate: IAggregateRoot) {
  // Ensure aggregate has required capabilities
  if (!hasAllCapabilities(aggregate, SnapshotCapability, VersioningCapability)) {
    throw new Error('Aggregate must have both snapshot and versioning capabilities');
  }

  // Safe to cast and use - we know capabilities exist
  const snapshotAggregate = asSnapshotAggregate(aggregate)!;
  const versioningAggregate = asVersioningAggregate(aggregate)!;

  // Use both capabilities
  const snapshot = snapshotAggregate.createSnapshot();
  versioningAggregate.incrementVersion();
}
```

### Conditional Feature Execution

```typescript
import { 
  asEventSourcingAggregate,
  createSnapshotIfCapable 
} from '@vytches/ddd-aggregates';

async function saveAggregate(aggregate: IAggregateRoot) {
  // Always try to create snapshot if possible
  const snapshot = createSnapshotIfCapable(aggregate);
  if (snapshot) {
    await snapshotRepository.save(snapshot);
  }

  // Use event sourcing if available
  const eventSourcingAggregate = asEventSourcingAggregate(aggregate);
  if (eventSourcingAggregate) {
    await eventSourcingAggregate.persistEvents();
  } else {
    // Fallback to regular persistence
    await regularRepository.save(aggregate);
  }
}
```

## Notes

- All type guard functions return `null` instead of throwing errors for safer usage
- These utilities enable polymorphic behavior based on aggregate capabilities
- Use `hasAllCapabilities()` when you need multiple capabilities to be present
- The type system ensures you can only call capability-specific methods after successful casting
- These functions work with any aggregate, regardless of how capabilities were added (builder or direct)