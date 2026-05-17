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

### Dispatch model — parallel within batch

`OutboxProcessor.processBatch()` dispatches all messages in the batch **in
parallel** via `Promise.allSettled`. This is intentional and contractual:

- A failure in message N does **not** block messages N+1..N+M
- Each message has independent retry/fail tracking via the repository
- For 200 messages at 10ms dispatch each: ~10ms parallel vs ~2s sequential

If you need strict ordering within a stream, set `batchSize: 1` (one message per
batch = sequential by definition). Note: parallel dispatch means the **execution
order** within a batch is not guaranteed, even when messages were selected via
`priorityOrder`.

For high-volume use cases where the batch is consistently full, consider
implementing the adapter pattern via `IOutboxMessageHandler` to dispatch to your
existing message broker (BullMQ, Kafka, RabbitMQ — your code, no library
dependency added).

```typescript
class BullMQOutboxHandler implements IOutboxMessageHandler {
  constructor(private readonly fanOut: MyFanOutService) {}
  async handle(message: IOutboxMessage): Promise<void> {
    await this.fanOut.dispatch(message.payload);
  }
}

const processor = new OutboxProcessor(repo, new BullMQOutboxHandler(fanOut), {
  pollIntervalMs: 2_000,
  batchSize: 200,
});
```

The library does **not** ship broker-specific adapters — that would force
adopters to bring in BullMQ/Kafka/etc. as transitive dependencies. Write the
~10-line adapter yourself; the library guarantees the interface contract.

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
