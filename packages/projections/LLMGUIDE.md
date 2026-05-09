# @vytches/ddd-projections - LLM Guide

## Purpose

Read-model projections for CQRS architectures: take a stream of domain events,
fold them into denormalized read models, support replay/rebuild, and expose
hooks for capabilities (checkpointing, dead-letter, error handling).

Storage-agnostic — implement `IProjectionStore` for your read database.

## Quick Start

```typescript
import {
  BaseProjection,
  ProjectionEngine,
  type IProjectionStore,
} from '@vytches/ddd-projections';
import type { IDomainEvent } from '@vytches/ddd-events';

// 1. Define a read model
interface OrderSummary {
  id: string;
  customerId: string;
  total: number;
  itemCount: number;
}

// 2. Define the projection
class OrderSummaryProjection extends BaseProjection<OrderSummary> {
  readonly name = 'OrderSummary';

  async handle(event: IDomainEvent): Promise<void> {
    if (event.eventName === 'OrderCreated') {
      await this.store.upsert(event.payload.orderId, {
        id: event.payload.orderId,
        customerId: event.payload.customerId,
        total: 0,
        itemCount: 0,
      });
    }

    if (event.eventName === 'ItemAdded') {
      const current = await this.store.get(event.payload.orderId);
      if (!current) return;
      await this.store.upsert(event.payload.orderId, {
        ...current,
        total: current.total + event.payload.price * event.payload.qty,
        itemCount: current.itemCount + event.payload.qty,
      });
    }
  }
}

// 3. Wire it up
const engine = new ProjectionEngine({ store: myStore });
engine.register(new OrderSummaryProjection(myStore));
await engine.start();
```

## Key API

| Export                        | Kind      | Description                                                    |
| ----------------------------- | --------- | -------------------------------------------------------------- |
| `BaseProjection<TReadModel>`  | abstract  | Extend to write a projection. Implements `name` + `handle()`   |
| `ProjectionEngine`            | class     | Routes events to registered projections                        |
| `ProjectionBuilder`           | class     | Fluent builder for assembling a projection without subclassing |
| `ProjectionRebuilder`         | class     | Replays a stream from t=0 to rebuild a read model              |
| `createProjectionRebuilder()` | factory   | Creates a configured `ProjectionRebuilder`                     |
| `IProjectionRebuildConfig`    | type      | `{ batchSize, fromCheckpoint, projectionName }`                |
| `IProjectionRebuilder`        | interface | Public contract for replay machinery                           |
| `IProjection`                 | interface | A projection's public shape                                    |
| `IProjectionEngine`           | interface | Engine's public shape                                          |
| `IProjectionStore`            | interface | **You implement this**: persistence for read models            |
| `IProjectionCapability`       | interface | Hook contract for cross-cutting concerns                       |
| `ICapabilityContext`          | type      | Passed to capability hooks                                     |
| `ErrorProjectionState`        | type      | State a projection enters on unrecoverable error               |
| `ProjectionError`             | error     | Base error for projection failures                             |

### Capabilities (concrete `IProjectionCapability` implementations)

| Export                         | Kind     | Description                                                      |
| ------------------------------ | -------- | ---------------------------------------------------------------- |
| `BaseIntervalCapability`       | abstract | Base for any time-windowed capability (checkpoints, snapshots)   |
| `CheckpointCapability`         | class    | Persists last-processed event offset; restart resumes from there |
| `SnapshotProjectionCapability` | class    | Periodically snapshots projection state for fast warm-up         |
| `CircuitBreakerCapability`     | class    | Stops projection after N consecutive errors; auto-resumes        |
| `DeadLetterCapability`         | class    | Routes failing events to a dead-letter store                     |

## Patterns

### Builder API for simple projections

```typescript
import { ProjectionBuilder } from '@vytches/ddd-projections';

const projection = new ProjectionBuilder<UserSummary>('UserSummary')
  .on('UserRegistered', async (e, store) => {
    await store.upsert(e.payload.userId, {
      id: e.payload.userId,
      name: e.payload.name,
    });
  })
  .on('UserRenamed', async (e, store) => {
    const cur = await store.get(e.payload.userId);
    if (cur)
      await store.upsert(e.payload.userId, { ...cur, name: e.payload.newName });
  })
  .build(store);
```

### Rebuild after schema change

```typescript
const rebuilder = createProjectionRebuilder({
  projectionName: 'OrderSummary',
  batchSize: 1000,
  fromCheckpoint: 0,
});
await rebuilder.rebuild(eventStore, projection);
```

### Production-ready engine with checkpoints + dead-letter

```typescript
import {
  ProjectionEngine,
  CheckpointCapability,
  DeadLetterCapability,
  CircuitBreakerCapability,
} from '@vytches/ddd-projections';

const engine = new ProjectionEngine({ store: readModelStore });

// Persist offset every 5 seconds → restart resumes seamlessly
engine.use(new CheckpointCapability(checkpointStore, { intervalMs: 5000 }));

// Route failing events to dead-letter store after 3 retries
engine.use(new DeadLetterCapability(deadLetterStore, { maxRetries: 3 }));

// Auto-pause projection after 10 consecutive errors
engine.use(new CircuitBreakerCapability({ failureThreshold: 10 }));

engine.register(new OrderSummaryProjection(readModelStore));
await engine.start();
```

## Anti-Patterns

- **Do not mutate aggregates inside a projection handler** — projections are
  read-only consumers. Mutations belong in command handlers.
- **Do not throw from `handle()`** — rely on the engine's error capability
  (dead-letter or retry). Throwing kills the engine loop.
- **Do not couple a projection to multiple bounded contexts** — one projection
  serves one read use case. Cross-context joins happen in the query handler, not
  the projection.
- **Do not skip checkpointing** — without it, restarts replay from t=0 every
  time. Use the shipped `CheckpointCapability`:
  ```typescript
  import { CheckpointCapability } from '@vytches/ddd-projections';
  engine.use(new CheckpointCapability(checkpointStore, { intervalMs: 5000 }));
  ```
- **Do not run a projection without a `DeadLetterCapability`** for events that
  may legitimately fail (e.g. unknown event names after a deploy) — otherwise
  one bad event blocks the whole projection forever.
