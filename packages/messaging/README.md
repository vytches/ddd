# @vytches/ddd-messaging

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-messaging.svg)](https://badge.fury.io/js/%40vytches%2Fddd-messaging)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Transactional Outbox pattern for reliable domain event delivery**

Provides the Outbox pattern — store-then-publish guarantee for domain events.
This package contains **only Outbox** infrastructure. There is no Saga support.

## Installation

```bash
pnpm add @vytches/ddd-messaging
```

## What's included

| Export                   | Kind           | Description                                                              |
| ------------------------ | -------------- | ------------------------------------------------------------------------ |
| `MessageStatus`          | enum           | `PENDING \| PROCESSING \| PROCESSED \| FAILED`                           |
| `MessagePriority`        | enum           | `low \| normal \| high \| critical`                                      |
| `OutboxMessageFactory`   | class          | Creates `IOutboxMessage` instances                                       |
| `OutboxProcessor`        | class          | Polls the repository and dispatches messages via registered handlers     |
| `EventBusOutboxHandler`  | class          | `IOutboxMessageHandler` that publishes to an `IEventBus`                 |
| `OutboxService`          | class          | High-level facade: store, schedule, and coordinate processing            |
| `IOutboxRepository`      | abstract class | Base repository contract — extend this for your storage backend          |
| `IOutboxMessage`         | interface      | Message shape with id, payload, status, priority, timestamps             |
| `IOutboxMessageHandler`  | interface      | Single-method handler: `handle(message): Promise<void>`                  |
| `OutboxMiddleware`       | type           | Middleware signature for the processor pipeline                          |
| `OutboxProcessorOptions` | interface      | Processor configuration (interval, batch size, retries, backoff, hooks…) |
| `OutboxProcessorHooks`   | interface      | Observability callbacks: batch complete, message failed, permanent fail  |
| `OutboxServiceOptions`   | interface      | Service configuration                                                    |
| `OutboxMessageOptions`   | interface      | Per-message options (priority, processAfter…)                            |
| `RetryBackoffConfig`     | interface      | Exponential backoff configuration for the processor                      |
| `comparePriority`        | function       | Compares two `MessagePriority` values by a given order array             |

## Quick start

```typescript
import {
  OutboxProcessor,
  OutboxMessageFactory,
  EventBusOutboxHandler,
  MessagePriority,
  type IOutboxRepository,
} from '@vytches/ddd-messaging';

// 1. Implement IOutboxRepository for your storage (e.g. PostgreSQL)
class PostgresOutboxRepository extends IOutboxRepository {
  async saveMessage(message) {
    /* INSERT INTO outbox ... */
  }
  async saveBatch(messages) {
    /* INSERT INTO outbox (batch) ... */
  }
  async getUnprocessedMessages(limit, priorityOrder, messageTypes) {
    // ORDER by priorityOrder array index — do NOT use ORDER BY priority string column
    /* SELECT ... WHERE status = 'PENDING' ORDER BY CASE priority ... */
  }
  async getById(id) {
    /* SELECT ... */
  }
  async updateStatus(id, status, error?) {
    /* UPDATE ... */
  }
  async updateStatusBatch(ids, status) {
    /* UPDATE ... */
  }
  async incrementAttempt(id) {
    /* UPDATE ... RETURNING attempts */
  }
  async deleteByStatusAndAge(olderThan, status) {
    /* DELETE ... */
  }
  async scheduleMessage(message, processAfter) {
    /* INSERT ... */
  }
}

// 2. Wire up the processor
const repo = new PostgresOutboxRepository(db);
const processor = new OutboxProcessor(repo, {
  batchSize: 50,
  processingInterval: 5_000,
  maxRetries: 3,
  retryBackoff: { initial: 1_000, multiplier: 2, maxDelay: 300_000 },
});

// Register a type-specific handler
processor.registerHandler('OrderCreated', new EventBusOutboxHandler(eventBus));

// Or a catch-all default handler for uniform fan-out
processor.registerDefaultHandler({
  async handle(message) {
    await myQueue.add(message.messageType, message.payload);
  },
});

processor.start();

// 3. Enqueue in the same transaction as your aggregate save
const factory = new OutboxMessageFactory();
await db.transaction(async tx => {
  await orderRepo.save(order, tx);
  await repo.saveMessage(
    factory.create({
      messageType: 'OrderCreated',
      payload: { orderId: order.id },
      priority: MessagePriority.HIGH,
    })
  );
});
```

## Custom message handler

Implement `IOutboxMessageHandler` to route messages any way you like:

```typescript
import { IOutboxMessageHandler, IOutboxMessage } from '@vytches/ddd-messaging';

class KafkaMessageHandler implements IOutboxMessageHandler {
  async handle(message: IOutboxMessage): Promise<void> {
    await kafkaProducer.send({
      topic: message.messageType,
      messages: [{ value: JSON.stringify(message.payload) }],
    });
  }
}

processor.registerHandler('OrderCreated', new KafkaMessageHandler());
```

## Default (catch-all) handler

For uniform dispatch — e.g. routing all event types to a single queue — use
`registerDefaultHandler` instead of registering per-type:

```typescript
processor.registerDefaultHandler({
  async handle(message) {
    await fanOutQueue.add(message.messageType, message.payload, {
      jobId: message.id,
    });
  },
});
```

> **Note:** Registering a default handler removes the implicit per-type
> allowlist. Validate `message.messageType` inside the handler if you need an
> explicit allowlist.

## Package boundaries

`@vytches/ddd-messaging` depends on:

- `@vytches/ddd-contracts` — `IDomainEvent`, `IEventBus`
- `@vytches/ddd-logging` — internal structured logging

## Note on Sagas

This package has **no Saga support**. For long-running process orchestration,
use a dedicated library (e.g. Temporal, Conductor).

## License

MIT
