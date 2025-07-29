# Aggregates Package Documentation

**Package**: `@vytches/ddd-aggregates`

## Overview

This package provides the core aggregate root functionality for Domain-Driven Design (DDD) applications. It includes the base `AggregateRoot` class, a fluent `AggregateBuilder` for configuring aggregates with capabilities, and utility functions for working with capability-enhanced aggregates.

## Package Structure

```
packages/aggregates/
├── src/
│   ├── core/                          # Core classes (reorganized)
│   │   ├── aggregate-root.ts          # AggregateRoot base class
│   │   ├── aggregate-root.builder.ts  # AggregateBuilder for fluent configuration
│   │   └── aggregate-utilities.ts     # Utility functions and type helpers
│   ├── capabilities/                  # Aggregate capabilities
│   │   ├── snapshot-capability.ts     # Snapshot support
│   │   ├── versioning-capability.ts   # Version control
│   │   ├── audit-capability.ts        # Audit trail
│   │   └── event-sourcing-capability.ts # Event sourcing
│   ├── aggregate-interfaces.ts        # TypeScript interfaces
│   ├── aggregate-errors.ts           # Error classes
│   └── index.ts                      # Main exports
└── docs/                             # Documentation (this folder)
    ├── AGGREGATE_ROOT_METHODS.md     # AggregateRoot class methods
    ├── AGGREGATE_BUILDER_METHODS.md  # AggregateBuilder class methods
    ├── UTILITY_FUNCTIONS.md         # Utility functions reference
    └── README.md                     # This file
```

## Main Classes & Their Methods

### 1. AggregateRoot Class (`src/core/aggregate-root.ts`)

**Purpose**: Base class for all domain aggregates. Manages domain events, versioning, and capabilities.

**Key Methods**:
- `getId()` - Get aggregate identifier
- `getVersion()` - Get current version
- `hasChanges()` - Check for uncommitted events
- `getDomainEvents()` - Get uncommitted domain events
- `commit()` - Mark events as committed
- `apply()` - Apply domain events (protected)
- `withCapability()` - Add capabilities

📖 **[Complete AggregateRoot Methods Reference →](./AGGREGATE_ROOT_METHODS.md)**

### 2. AggregateBuilder Class (`src/core/aggregate-root.builder.ts`)

**Purpose**: Fluent builder for creating aggregates with specific capabilities.

**Key Methods**:
- `AggregateBuilder.create()` - Start builder (static)
- `withSnapshots()` - Add snapshot capability
- `withVersioning()` - Add versioning capability
- `withAudit()` - Add audit capability
- `withEventSourcing()` - Add event sourcing capability
- `build()` - Create the final aggregate

📖 **[Complete AggregateBuilder Methods Reference →](./AGGREGATE_BUILDER_METHODS.md)**

### 3. Utility Functions (`src/core/aggregate-utilities.ts`)

**Purpose**: Helper functions for working with capability-enhanced aggregates.

**Key Functions**:
- `asSnapshotAggregate()` - Safe casting to snapshot-capable aggregate
- `asVersioningAggregate()` - Safe casting to versioning-capable aggregate
- `getAggregateCapabilities()` - List all capabilities
- `hasAllCapabilities()` - Check for multiple capabilities

📖 **[Complete Utility Functions Reference →](./UTILITY_FUNCTIONS.md)**

## Quick Start Examples

### Basic Aggregate Usage

```typescript
import { AggregateRoot, EntityId } from '@vytches/ddd-aggregates';

class UserAggregate extends AggregateRoot<string> {
  constructor(params: { id: EntityId<string>; email: string }) {
    super({ id: params.id });
    // Initialize aggregate state
  }

  // Domain methods that apply events
  updateEmail(newEmail: string): void {
    this.apply('UserEmailUpdated', { newEmail });
  }
}

// Usage
const user = new UserAggregate({
  id: EntityId.createWithRandomUUID(),
  email: 'user@example.com'
});

user.updateEmail('newemail@example.com');
console.log(user.hasChanges()); // true
console.log(user.getDomainEvents().length); // 1
```

### Using AggregateBuilder

```typescript
import { AggregateBuilder, EntityId } from '@vytches/ddd-aggregates';

// Create aggregate with multiple capabilities
const aggregate = AggregateBuilder
  .create({ id: EntityId.createWithRandomUUID() })
  .withSnapshots()     // Enable snapshots
  .withVersioning()    // Enable optimistic concurrency
  .withAudit()        // Enable audit trail
  .build();

// Check capabilities
console.log(aggregate.hasCapability(SnapshotCapability)); // true
```

### Using Utility Functions

```typescript
import { 
  asSnapshotAggregate,
  getAggregateCapabilities 
} from '@vytches/ddd-aggregates';

// Safe capability usage
const snapshotAggregate = asSnapshotAggregate(myAggregate);
if (snapshotAggregate) {
  const snapshot = snapshotAggregate.createSnapshot();
}

// List all capabilities
const capabilities = getAggregateCapabilities(myAggregate);
console.log('Available capabilities:', capabilities);
```

## Why This Organization?

The package was reorganized to solve confusion about which `create` method belongs to which class:

### Before (Confusing):
- Mixed methods from different classes in same documentation
- Unclear which `create()` method belonged to which class
- Files at root level without clear separation

### After (Clear):
- **`core/aggregate-root.ts`** - Contains only AggregateRoot methods
- **`core/aggregate-root.builder.ts`** - Contains only AggregateBuilder methods (including `create()`)
- **`core/aggregate-utilities.ts`** - Contains only utility functions
- **Dedicated documentation** - Each class has its own detailed method reference

## Available Capabilities

The package includes several built-in capabilities:

1. **SnapshotCapability** - Create and restore from aggregate snapshots
2. **VersioningCapability** - Optimistic concurrency control with version tracking
3. **AuditCapability** - Track who made changes and when
4. **EventSourcingCapability** - Full event sourcing support with replay

Each capability adds specific methods to aggregates when applied.

## Import Guidelines

```typescript
// Import main classes
import { AggregateRoot, AggregateBuilder } from '@vytches/ddd-aggregates';

// Import utility functions
import { 
  asSnapshotAggregate,
  getAggregateCapabilities 
} from '@vytches/ddd-aggregates';

// Import capabilities
import { 
  SnapshotCapability,
  VersioningCapability 
} from '@vytches/ddd-aggregates';

// Import types
import type { IAggregateRoot } from '@vytches/ddd-aggregates';
```

## Next Steps

1. 📖 Read the detailed method references for each class
2. 🧪 Try the examples in your own code  
3. 🔧 Explore the capabilities system for advanced features
4. 📚 Check out the related packages: `@vytches/ddd-core`, `@vytches/ddd-events`

---

**Note**: This documentation reflects the reorganized structure where core classes are separated into distinct files with clear responsibilities.