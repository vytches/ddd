# @vytches/ddd-projections

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-projections.svg)](https://badge.fury.io/js/%40vytches%2Fddd-projections)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Event projections and read-model building for CQRS / Event Sourcing applications**

## Installation

```bash
pnpm add @vytches/ddd-projections
```

## What's included

### Core classes

| Export | Kind | Description |
|--------|------|-------------|
| `ProjectionEngine` | class | Orchestrates projection execution; routes events to registered projections |
| `BaseProjection<TReadModel>` | class | Abstract base for projections — implement `name`, `eventTypes`, `createInitialState()`, `apply()` |
| `ProjectionBuilder` | class | Fluent builder for constructing `ProjectionEngine` instances |
| `ProjectionRebuilder` | class | Replays historical events to rebuild a projection from scratch |
| `createProjectionRebuilder` | function | Factory shorthand for `ProjectionRebuilder` |

### Capabilities (opt-in projection features)

| Export | Kind | Description |
|--------|------|-------------|
| `BaseIntervalCapability` | class | Base for interval-based capability implementations |
| `CheckpointCapability` | class | Persists last-processed event position for resumable processing |
| `CircuitBreakerCapability` | class | Stops projection processing on repeated failures |
| `DeadLetterCapability` | class | Routes failed events to a dead-letter store |
| `SnapshotProjectionCapability` | class | Periodically snapshots the read model for faster rebuilds |

### Interfaces

| Export | Kind | Description |
|--------|------|-------------|
| `IProjection<TReadModel>` | interface | Core projection contract |
| `IProjectionEngine` | interface | Engine contract |
| `IProjectionCapability` | interface | Base capability contract |
| `IProjectionStore` | interface | Read-model persistence contract |
| `ICapabilityContext` | interface | Context passed to capabilities during execution |
| `ErrorProjectionState` | interface | Shape used when a projection enters an error state |
| `IProjectionRebuildConfig` | interface | Configuration for `ProjectionRebuilder` |
| `IProjectionRebuilder` | interface | Rebuilder contract |

### Errors

| Export | Kind | Description |
|--------|------|-------------|
| `ProjectionError` | class | Error thrown for projection-specific failures |

## Quick start

```typescript
import { BaseProjection, ProjectionEngine } from '@vytches/ddd-projections';
import type { IDomainEvent } from '@vytches/ddd-contracts';

interface OrderReadModel {
  orderId: string;
  status: 'pending' | 'confirmed' | 'shipped';
  total: number;
}

class OrderProjection extends BaseProjection<OrderReadModel> {
  readonly name = 'OrderProjection';
  readonly eventTypes = ['OrderCreated', 'OrderConfirmed', 'OrderShipped'];

  createInitialState(): OrderReadModel {
    return { orderId: '', status: 'pending', total: 0 };
  }

  apply(model: OrderReadModel, event: IDomainEvent): OrderReadModel {
    switch (event.eventName) {
      case 'OrderCreated':
        return { ...model, orderId: event.payload.orderId, total: event.payload.total };
      case 'OrderConfirmed':
        return { ...model, status: 'confirmed' };
      case 'OrderShipped':
        return { ...model, status: 'shipped' };
      default:
        return model;
    }
  }
}

const engine = new ProjectionEngine();
engine.register(new OrderProjection());

// Process an event
await engine.process(orderCreatedEvent);
const state = engine.getState<OrderReadModel>('OrderProjection');
```

## With capabilities

```typescript
import {
  ProjectionBuilder,
  CheckpointCapability,
  CircuitBreakerCapability,
  SnapshotProjectionCapability,
} from '@vytches/ddd-projections';

const engine = new ProjectionBuilder()
  .withProjection(new OrderProjection())
  .withCapability(new CheckpointCapability(checkpointStore))
  .withCapability(new CircuitBreakerCapability({ threshold: 5 }))
  .withCapability(new SnapshotProjectionCapability({ interval: 100 }))
  .build();
```

## Rebuilding from history

```typescript
import { createProjectionRebuilder } from '@vytches/ddd-projections';

const rebuilder = createProjectionRebuilder({
  eventStore,
  projections: [new OrderProjection()],
  batchSize: 500,
});

await rebuilder.rebuild();
```

## Package boundaries

`@vytches/ddd-projections` depends on:
- `@vytches/ddd-contracts` — `IDomainEvent`, `IEventStore`
- `@vytches/ddd-logging` — internal logging

## License

MIT
