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

| Export                   | Kind           | Description                                                     |
| ------------------------ | -------------- | --------------------------------------------------------------- |
| `MessageStatus`          | enum           | `PENDING \| PROCESSING \| PROCESSED \| FAILED`                  |
| `MessagePriority`        | enum           | `LOW \| NORMAL \| HIGH \| CRITICAL`                             |
| `OutboxMessageFactory`   | class          | Creates `IOutboxMessage` instances                              |
| `OutboxProcessor`        | class          | Polls the repository and dispatches messages                    |
| `EventBusOutboxHandler`  | class          | `IOutboxMessageHandler` that publishes to an `IEventBus`        |
| `OutboxService`          | class          | High-level facade: store, schedule, and coordinate processing   |
| `IOutboxRepository`      | abstract class | Base repository contract — extend this for your storage backend |
| `IOutboxMessage`         | interface      | Message shape with id, payload, status, priority, timestamps    |
| `IOutboxMessageHandler`  | interface      | Single-method handler: `handle(message): Promise<void>`         |
| `OutboxMiddleware`       | type           | Middleware signature for the processor pipeline                 |
| `OutboxProcessorOptions` | interface      | Processor configuration (interval, batch size, retries…)        |
| `OutboxServiceOptions`   | interface      | Service configuration                                           |
| `OutboxMessageOptions`   | interface      | Per-message options (priority, processAfter…)                   |
| `RetryBackoffConfig`     | interface      | Exponential backoff configuration for the processor             |

## Quick start

```typescript
import {
  OutboxService,
  OutboxProcessor,
  OutboxMessageFactory,
  EventBusOutboxHandler,
  MessagePriority,
} from '@vytches/ddd-messaging';
import { UnifiedEventBus } from '@vytches/ddd-events';

// Implement IOutboxRepository for your storage (e.g. PostgreSQL)
class PostgresOutboxRepository extends IOutboxRepository {
  async save(message) {
    /* ... */
  }
  async findPending(limit) {
    /* ... */
  }
  async markProcessed(id) {
    /* ... */
  }
  async markFailed(id, error) {
    /* ... */
  }
}

const repository = new PostgresOutboxRepository();
const eventBus = new UnifiedEventBus();

// Service stores messages, processor dispatches them
const service = new OutboxService(repository);
const handler = new EventBusOutboxHandler(eventBus);
const processor = new OutboxProcessor(repository, handler, {
  processingInterval: 5_000,
  batchSize: 50,
  maxRetries: 3,
});

// Store a message (call this inside your aggregate save transaction)
const factory = new OutboxMessageFactory();
const message = factory.create({
  messageType: 'OrderCreated',
  payload: { orderId: '123' },
  priority: MessagePriority.HIGH,
});
await service.store(message);

// Start polling
await processor.start();
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
```

## Implement your repository

Extend `IOutboxRepository` and provide persistence:

```typescript
import {
  IOutboxRepository,
  IOutboxMessage,
  MessageStatus,
} from '@vytches/ddd-messaging';

class MyOutboxRepository extends IOutboxRepository {
  async save(message: IOutboxMessage): Promise<void> {
    await db.outbox.insert(message);
  }

  async findPendingMessages(limit: number): Promise<IOutboxMessage[]> {
    return db.outbox.findWhere({ status: MessageStatus.PENDING }, limit);
  }

  async markAsProcessed(id: string): Promise<void> {
    await db.outbox.update(id, { status: MessageStatus.PROCESSED });
  }

  async markAsFailed(id: string, error: string): Promise<void> {
    await db.outbox.update(id, {
      status: MessageStatus.FAILED,
      lastError: error,
    });
  }
}
```

## Package boundaries

`@vytches/ddd-messaging` depends on:

- `@vytches/ddd-contracts` — `IDomainEvent`, `IEventBus`
- `@vytches/ddd-logging` — internal structured logging

## Note on Sagas

This package has **no Saga support**. For long-running process orchestration,
use a dedicated library (e.g. Temporal, Conductor).

## License

MIT
