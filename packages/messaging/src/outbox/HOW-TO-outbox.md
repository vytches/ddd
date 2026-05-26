# Outbox Pattern — How-To Guide

## Overview

The Outbox pattern guarantees at-least-once delivery of integration events by
writing messages to the database in the same transaction as the domain state
change. A background processor then polls and dispatches them.

## Core Components

### `IOutboxMessage`

```typescript
interface IOutboxMessage<T = unknown> {
  id: string;
  messageType: string;
  payload: T;
  metadata: Record<string, unknown>;
  status: MessageStatus; // PENDING | PROCESSING | PROCESSED | FAILED
  attempts: number;
  createdAt: Date;
  processAfter?: Date; // for delayed / retry-backoff scheduling
  priority?: MessagePriority; // low | normal | high | critical
  lastError?: string;
}
```

### `IOutboxRepository` — what you implement

Extend this abstract class for your storage backend:

```typescript
class PgOutboxRepository extends IOutboxRepository {
  async saveMessage<T>(message: IOutboxMessage<T>): Promise<string> { ... }
  async saveBatch<T>(messages: IOutboxMessage<T>[]): Promise<string[]> { ... }

  async getUnprocessedMessages(
    limit?: number,
    priorityOrder?: MessagePriority[],
    messageTypes?: string[]
  ): Promise<IOutboxMessage[]> {
    // IMPORTANT: sort by priorityOrder array index, NOT by the priority column string.
    // 'critical' < 'high' alphabetically, so ORDER BY priority DESC processes CRITICAL last.
    // Use a CASE expression:
    //   ORDER BY CASE priority
    //     WHEN 'critical' THEN 0
    //     WHEN 'high'     THEN 1
    //     WHEN 'normal'   THEN 2
    //     WHEN 'low'      THEN 3
    //     ELSE 4
    //   END
    // Or use the exported comparePriority() helper for in-memory sorting.
  }

  async getById(id: string): Promise<IOutboxMessage | null> { ... }
  async updateStatus(id: string, status: MessageStatus, error?: Error): Promise<void> { ... }
  async updateStatusBatch(ids: string[], status: MessageStatus): Promise<void> { ... }
  async incrementAttempt(id: string): Promise<number> { ... }
  async deleteByStatusAndAge(olderThan: Date, status: MessageStatus): Promise<number> { ... }
  async scheduleMessage<T>(message: IOutboxMessage<T>, processAfter: Date): Promise<string> { ... }

  // Optional overrides (default: no-op)
  async scheduleRetry(id: string, processAfter: Date): Promise<void> { ... }
  async resetStaleProcessing(olderThan: Date): Promise<number> { ... }
}
```

## Creating messages

```typescript
import { OutboxMessageFactory, MessagePriority } from '@vytches/ddd-messaging';

const factory = new OutboxMessageFactory();

const message = factory.create({
  messageType: 'order.placed',
  payload: { orderId: '123', customerId: 'abc' },
  priority: MessagePriority.HIGH,
});
```

## Saving in a transaction

Always save the outbox message in the same transaction as the aggregate:

```typescript
await db.transaction(async tx => {
  await orderRepo.save(order, tx);
  await outboxRepo.saveMessage(
    factory.create({
      messageType: 'order.placed',
      payload: { orderId: order.id },
      priority: MessagePriority.HIGH,
    })
  );
});
```

## Setting up the processor

```typescript
import { OutboxProcessor, MessagePriority } from '@vytches/ddd-messaging';

const processor = new OutboxProcessor(repo, {
  batchSize: 50,
  processingInterval: 2_000, // ms between polls
  maxRetries: 3,
  messageTimeout: 30_000,
  retryBackoff: { initial: 1_000, multiplier: 2, maxDelay: 300_000 },
  startupJitterMs: 500, // de-synchronize multi-pod starts
  adaptiveRepoll: true, // drain backlog without waiting full interval
  crashRecoveryIntervalMs: 60_000,
});
```

## Registering handlers

### Per-type handler (strict allowlist)

```typescript
processor.registerHandler('order.placed', new OrderPlacedHandler(eventBus));
processor.registerHandler(
  'payment.captured',
  new PaymentCapturedHandler(queue)
);
```

### Default (catch-all) handler for fan-out

When all event types are handled identically (e.g. route to a queue per
context):

```typescript
import { type IOutboxMessageHandler } from '@vytches/ddd-messaging';

const KNOWN_TYPES = new Set([
  'order.placed',
  'payment.captured',
  'user.registered',
]);

const fanOut: IOutboxMessageHandler = {
  async handle(message) {
    // Validate against known set — default handler removes the implicit allowlist
    if (!KNOWN_TYPES.has(message.messageType)) {
      throw new Error(`Unknown message type: ${message.messageType}`);
    }
    await queue.add(message.messageType, message.payload, {
      jobId: message.id,
    });
  },
};

processor.registerDefaultHandler(fanOut);
```

> **Warning:** `registerDefaultHandler` removes the implicit per-type allowlist.
> Any future message type (including typos or injected rows) will be dispatched
> automatically. Always validate `message.messageType` inside the handler.

## Priority helper

For in-memory sorting or custom repository implementations:

```typescript
import { comparePriority, MessagePriority } from '@vytches/ddd-messaging';

// Sort highest-priority first:
messages.sort((a, b) =>
  comparePriority(
    a.priority ?? MessagePriority.NORMAL,
    b.priority ?? MessagePriority.NORMAL
  )
);

// Custom order:
const order = [
  MessagePriority.HIGH,
  MessagePriority.CRITICAL,
  MessagePriority.NORMAL,
  MessagePriority.LOW,
];
messages.sort((a, b) => comparePriority(a.priority!, b.priority!, order));
```

Missing values in the `order` array sort last (not first) — safe for partial
arrays.

## Observability hooks

```typescript
const processor = new OutboxProcessor(repo, {
  hooks: {
    onBatchComplete({ processed, failed, durationMs }) {
      metrics.record('outbox.batch', { processed, failed, durationMs });
    },
    onMessageFailed(message, error, attempt) {
      logger.warn(
        `Message ${message.id} failed (attempt ${attempt}): ${error.message}`
      );
    },
    onPermanentFailure(message, error) {
      alerting.send(
        `Permanent outbox failure: ${message.messageType} / ${message.id}`
      );
    },
  },
});
```

## Processor lifecycle

```typescript
processor.start(); // begins polling loop (with optional startupJitterMs delay)
processor.stop(); // stops polling, clears timers

const stats = await processor.getStats();
// { isRunning, batchSize, maxRetries, processingInterval,
//   registeredHandlers, middlewareCount, hasDefaultHandler }
```

## Multiple processors on the same table

Use `messageTypes` to partition the outbox between specialized processors:

```typescript
// General fan-out processor
const generalProcessor = new OutboxProcessor(repo, {
  batchSize: 200,
  adaptiveRepoll: true,
});
generalProcessor.registerDefaultHandler(fanOutHandler);
generalProcessor.start();

// Dedicated GDPR audit processor
const gdprProcessor = new OutboxProcessor(repo, {
  messageTypes: ['GdprAuditChainAppend'],
  batchSize: 10,
});
gdprProcessor.registerHandler('GdprAuditChainAppend', new GdprChainHandler());
gdprProcessor.start();
```

Both processors use `FOR UPDATE SKIP LOCKED` (your repository implementation) to
avoid processing the same row twice.
