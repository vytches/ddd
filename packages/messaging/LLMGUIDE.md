# @vytches/ddd-messaging - LLM Guide

## Purpose

Outbox pattern implementation for at-least-once delivery of integration events.
Provides the storage-agnostic interfaces and the orchestration logic (processor,
factory, service); consumers plug in their own `IOutboxRepository` (Postgres,
Redis, in-memory, etc.).

True to the library's philosophy: **no database adapter ships with the package**
— bring your own storage.

## Quick Start

```typescript
import {
  OutboxService,
  OutboxProcessor,
  OutboxMessageFactory,
  EventBusOutboxHandler,
  MessageStatus,
  MessagePriority,
  type IOutboxRepository,
} from '@vytches/ddd-messaging';

// 1. Implement the repository for your storage (example sketch)
class PgOutboxRepository implements IOutboxRepository {
  async save(message) {
    /* INSERT INTO outbox ... */
  }
  async findPending(limit) {
    /* SELECT ... WHERE status = 'pending' */
  }
  async markDispatched(id) {
    /* UPDATE ... */
  }
  async markFailed(id, error) {
    /* UPDATE ... */
  }
  // ...
}

// 2. Wire up the outbox service
const repo = new PgOutboxRepository(db);
const factory = new OutboxMessageFactory();
const handler = new EventBusOutboxHandler(integrationBus);
const processor = new OutboxProcessor(repo, handler, {
  pollIntervalMs: 1_000,
  batchSize: 50,
});

const outbox = new OutboxService(repo, factory, processor);

// 3. In a transaction with your aggregate save
await db.transaction(async tx => {
  await orderRepo.save(order, tx);
  await outbox.enqueue(
    integrationEvent,
    { priority: MessagePriority.High },
    tx
  );
});
```

## Key API

| Export                   | Kind      | Description                                                      |
| ------------------------ | --------- | ---------------------------------------------------------------- |
| `IOutboxMessage`         | interface | The shape of a stored outbox row                                 |
| `IOutboxRepository`      | interface | **You implement this**: persistence for outbox messages          |
| `IOutboxMessageHandler`  | interface | How to dispatch a stored message (default: publish to event bus) |
| `OutboxMessageOptions`   | type      | `{ priority, dedupKey, headers }` per-message overrides          |
| `OutboxMiddleware`       | type      | Hook for cross-cutting concerns (tracing, encryption)            |
| `OutboxProcessorOptions` | type      | `{ pollIntervalMs, batchSize, maxRetries, ... }`                 |
| `OutboxServiceOptions`   | type      | Top-level config bag                                             |
| `MessageStatus`          | enum      | `Pending`, `Dispatched`, `Failed`, `DeadLettered`                |
| `MessagePriority`        | enum      | `Low`, `Normal`, `High`, `Critical`                              |
| `OutboxMessageFactory`   | class     | Build `IOutboxMessage` from an integration event                 |
| `OutboxProcessor`        | class     | Polls repo, dispatches via handler, updates status               |
| `EventBusOutboxHandler`  | class     | Default handler — publishes via an `IIntegrationEventBus`        |
| `OutboxService`          | class     | Facade combining factory + processor for the application         |

## Patterns

### Transactional outbox

Always enqueue the outbox row in **the same transaction** as the aggregate save.
This is the whole point — the outbox row and the state change commit atomically.
The processor then picks up pending rows asynchronously.

```typescript
await db.transaction(async tx => {
  await orderRepo.save(order, tx);
  // critical: same tx
  await outboxRepo.save(factory.fromEvent(orderPlacedEvent), tx);
});
```

### Idempotent consumers

Set a deduplication key on each outbox message so consumers can ignore
re-deliveries (which **will** happen with at-least-once).

```typescript
await outbox.enqueue(event, { dedupKey: `order-${orderId}-placed` });
```

## Anti-Patterns

- **Do not enqueue outbox messages outside the aggregate save transaction** — if
  the save commits but the outbox enqueue fails, the integration event is lost
  forever.
- **Do not assume exactly-once delivery** — outbox is at-least-once. Make
  consumers idempotent.
- **Do not use the outbox for synchronous request/response** — it is for
  fire-and-forget integration events. Use a different abstraction (RPC, query
  handler) for sync flows.
- **Do not skip the dead-letter path** — messages that exceed retry budget must
  land somewhere observable, or you'll silently lose data.
