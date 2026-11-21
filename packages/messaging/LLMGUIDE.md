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
  OutboxProcessor,
  OutboxMessageFactory,
  EventBusOutboxHandler,
  MessagePriority,
  IOutboxRepository,
  type IOutboxMessageHandler,
} from '@vytches/ddd-messaging';

// 1. Implement the repository for your storage
class PgOutboxRepository extends IOutboxRepository {
  async saveMessage(message) {
    /* INSERT INTO outbox ... */
  }
  async saveBatch(messages) {
    /* INSERT INTO outbox ... */
  }
  async getUnprocessedMessages(limit, priorityOrder, messageTypes) {
    // IMPORTANT: order by priorityOrder array index, NOT alphabetically
    // See "Priority ordering in repository implementations" below
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
const repo = new PgOutboxRepository(db);
const handler = new EventBusOutboxHandler(integrationBus);

const processor = new OutboxProcessor(repo, {
  batchSize: 50,
  processingInterval: 1_000,
  retryBackoff: { initial: 1_000, multiplier: 2, maxDelay: 300_000 },
});
// createFromIntegrationEvent prefixes the type: `integration_event:<eventName>`
processor.registerHandler('integration_event:order.placed', handler);
processor.start();

// 3. Enqueue in the same transaction as your aggregate save
await db.transaction(async tx => {
  await orderRepo.save(order, tx);
  // `txRepo` is your repository writing through the same transaction `tx`
  await txRepo.saveMessage(
    OutboxMessageFactory.createFromIntegrationEvent(integrationEvent, {
      priority: MessagePriority.HIGH,
    })
  );
});
```

## Key API

| Export                             | Kind           | Description                                                                     |
| ---------------------------------- | -------------- | ------------------------------------------------------------------------------- |
| `IOutboxMessage`                   | interface      | The shape of a stored outbox row                                                |
| `IOutboxRepository`                | abstract class | **You extend this**: persistence for outbox messages                            |
| `IOutboxMessageHandler`            | interface      | How to dispatch a stored message (default: publish to event bus)                |
| `OutboxMessageOptions`             | type           | `{ processAfter, priority, metadata }` per-message overrides                    |
| `OutboxMiddleware`                 | type           | Hook for cross-cutting concerns (tracing, encryption)                           |
| `OutboxProcessorOptions`           | type           | `{ batchSize, maxRetries, processingInterval, messageTimeout, ... }`            |
| `OutboxServiceOptions`             | type           | Top-level config bag                                                            |
| `OutboxHandlerContext`             | type           | 2nd argument of `handle()`: `{ signal, attempt, deadline, messageId }`          |
| `OutboxHandlerRegistrationOptions` | type           | `registerHandler` 3rd argument: `{ messageTimeoutMs }`                          |
| `ResetStaleProcessingOptions`      | type           | 2nd argument of `resetStaleProcessing()`: `{ messageTypes, maxRetries }`        |
| `FencedOutboxRepository`           | type           | `IOutboxRepository` that implements the three `*Fenced` writes                  |
| `OutboxTimeoutError`               | class          | Typed timeout error; also the `signal.reason` on timeout                        |
| `OutboxProcessorHooks`             | type           | Observability callbacks (batch, failure, timeout, late settle, stale write, …)  |
| `RetryBackoffConfig`               | type           | `{ initial, multiplier, maxDelay }` for retry backoff                           |
| `OutboxHandlerTimeoutInfo`         | type           | 2nd argument of `onHandlerTimeout`: `{ timeoutMs, attempt }`                    |
| `OutboxLateSettleOutcome`          | type           | `'resolved' \| 'rejected'` — argument of `onLateSettle`                         |
| `OutboxStaleWriteOperation`        | type           | `'complete' \| 'recordFailure' \| 'release'` — argument of `onStaleWrite`       |
| `OutboxCompletionWriteFailure`     | type           | 3rd argument of `onCompletionWriteFailed`: `{ consecutiveFailures, released }`  |
| `OutboxFencedReleaseOutcome`       | type           | 3rd argument of `releaseFenced`: `{ status, processAfter?, error? }`            |
| `OutboxTimeoutErrorDetails`        | type           | Constructor argument of `OutboxTimeoutError`                                    |
| `MessageStatus`                    | enum           | `PENDING`, `PROCESSING`, `PROCESSED`, `FAILED`                                  |
| `MessagePriority`                  | enum           | `LOW`, `NORMAL`, `HIGH`, `CRITICAL` (values `'low'` … `'critical'`)             |
| `OutboxMessageFactory`             | class          | Build `IOutboxMessage` from an integration event                                |
| `OutboxProcessor`                  | class          | Polls repo, dispatches via handler, updates status                              |
| `EventBusOutboxHandler`            | class          | Default handler — publishes via an `IEventBus`                                  |
| `OutboxService`                    | class          | Facade combining factory + processor for the application                        |
| `comparePriority`                  | function       | Sorts `MessagePriority` values by a given order array (safe for partial arrays) |

## Patterns

### Transactional outbox

Always enqueue the outbox row in **the same transaction** as the aggregate save.
This is the whole point — the outbox row and the state change commit atomically.
The processor then picks up pending rows asynchronously.

```typescript
await db.transaction(async tx => {
  await orderRepo.save(order, tx);
  // critical: same tx — `txRepo` writes through `tx`
  await txRepo.saveMessage(
    OutboxMessageFactory.createFromIntegrationEvent(orderPlacedEvent)
  );
});
```

### Idempotent consumers

Deliveries **will** repeat with at-least-once. Make the effect idempotent by
keying it on something stable across retries: `message.id` (also
`context.messageId`), or an id you put in `metadata`. `context.attempt` changes
on every retry, so it is NOT an idempotency key.

```typescript
async handle(message: IOutboxMessage, ctx?: OutboxHandlerContext): Promise<void> {
  await this.payments.capture(message.payload, { idempotencyKey: message.id });
}
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

const processor = new OutboxProcessor(repo, {
  processingInterval: 2_000,
  batchSize: 200,
});
processor.registerDefaultHandler(new BullMQOutboxHandler(fanOut));
```

The library does **not** ship broker-specific adapters — that would force
adopters to bring in BullMQ/Kafka/etc. as transitive dependencies. Write the
~10-line adapter yourself; the library guarantees the interface contract.

### Fan-out: one default handler for N event types

When you want a single handler to process all (or most) outbox message types —
for example, routing every integration event to a BullMQ per-context queue — use
`registerDefaultHandler` instead of registering the same handler 50 times.

```typescript
class FanOutHandler implements IOutboxMessageHandler {
  constructor(private readonly queues: Map<string, Queue>) {}

  async handle(message: IOutboxMessage): Promise<void> {
    // RECOMMENDED: validate against a known-types set so new event types
    // added to the domain are caught early rather than silently dispatched.
    if (!KNOWN_EVENT_TYPES.has(message.messageType)) {
      throw new Error(`Unknown event type: ${message.messageType}`);
    }
    const queue =
      this.queues.get(message.messageType) ?? this.queues.get('default');
    await queue?.add(message.messageType, message.payload, {
      jobId: message.id,
    });
  }
}

const processor = new OutboxProcessor(repo, { batchSize: 200 });
processor.registerDefaultHandler(new FanOutHandler(queues));
processor.start();
```

**Security warning:** `registerDefaultHandler` removes the implicit type
allowlist that exists when only `registerHandler` is used. Before the default
handler existed, an unknown `messageType` would always throw — an implicit
safety net. After registering a default handler, ALL future message types
(including ones added later by mistake or injected via a compromised storage
layer) will be dispatched automatically. Always validate `message.messageType`
against an explicit known-types set inside the default handler.

**Interaction with `messageTypes` option:** if
`OutboxProcessorOptions.messageTypes` is set, the default handler will only see
messages whose type passes that filter. To catch every type, leave
`messageTypes` unset.

**PII and new event types:** when a new domain event type carrying PII is added,
review access controls on all downstream queues — the default handler will
dispatch it to all configured destinations without any per-type gating.

### Priority ordering in repository implementations

`IOutboxRepository.getUnprocessedMessages` receives a `priorityOrder` array such
as `[CRITICAL, HIGH, NORMAL, LOW]`. Repository implementations **MUST** order by
the array index, not by raw column value. String comparison on the `priority`
column (`ORDER BY priority DESC`) silently inverts the intent:
`'normal' > 'low' > 'high' > 'critical'` alphabetically.

Correct SQL using a `CASE` expression:

```sql
ORDER BY
  CASE priority
    WHEN 'critical' THEN 0
    WHEN 'high'     THEN 1
    WHEN 'normal'   THEN 2
    WHEN 'low'      THEN 3
    ELSE                 4   -- unknown priorities sort last
  END
```

Or use the exported `comparePriority` helper in in-process sorting:

```typescript
import { comparePriority } from '@vytches/ddd-messaging';

// Sort an in-memory array highest-priority-first:
messages.sort((a, b) =>
  comparePriority(
    a.priority ?? MessagePriority.NORMAL,
    b.priority ?? MessagePriority.NORMAL
  )
);
```

`comparePriority` is safe with partial or custom order arrays — values absent
from the array sort last rather than accidentally first.

## Handler timeouts, cancellation and crash recovery

### Timeouts are per message, and they do not stop the handler

`messageTimeout` (default 30 000 ms) limits one `handler.handle()` call, **per
message, not per batch**. It does not cover middleware, claiming or status
writes — a middleware that never settles stalls the whole batch, so keep
middleware fast and bounded. When the timeout expires the processor records a
failed attempt and releases the message — but a handler that ignores
cancellation **keeps running**, and the retry can start while it is still
running. Always make handlers idempotent; cancellation only narrows the window.

Override the timeout for one message type (everything else keeps the default):

```typescript
processor.registerHandler('payment.capture', paymentHandler, {
  messageTimeoutMs: 120_000,
});
processor.registerDefaultHandler(fallbackHandler, { messageTimeoutMs: 10_000 });
```

`messageTimeout` and `messageTimeoutMs` must be positive numbers ≤ 2 147 483 647
(`RangeError` otherwise). If you set an explicit `crashRecoveryThresholdMs`, it
must be ≥ every timeout (`registerHandler` throws `RangeError` otherwise). If
you leave it unset it follows the largest timeout:
`max(300_000, largest timeout)`.

### Handlers with and without a signal

`handle()` receives a second argument, always provided by `OutboxProcessor`:

```typescript
interface OutboxHandlerContext {
  readonly signal: AbortSignal; // aborted with OutboxTimeoutError on timeout
  readonly attempt: number; // 1-based (message.attempts + 1)
  readonly deadline: Date; // when this invocation times out
  readonly messageId: string;
}
```

```typescript
// Without a signal — unchanged, keeps working:
class PlainHandler implements IOutboxMessageHandler {
  async handle(message: IOutboxMessage): Promise<void> {
    await this.mailer.send(message.payload);
  }
}

// With a signal — pass it to anything cancellable. Declaring the parameter as
// required is fine (the processor always supplies it) and avoids `ctx?.`:
class CancellableHandler implements IOutboxMessageHandler {
  async handle(
    message: IOutboxMessage,
    ctx: OutboxHandlerContext
  ): Promise<void> {
    await fetch(this.url, {
      method: 'POST',
      body: JSON.stringify(message.payload),
      signal: ctx.signal,
    });
  }
}
```

- The signal is aborted **only** by the timeout, with an `OutboxTimeoutError` as
  `signal.reason` (its `message` is still `'Message processing timeout'`; log
  `error.messageType`, `error.timeoutMs` and `error.attempt` for context). Abort
  needs a runtime with `AbortController.abort(reason)` (Node ≥ 17.2).
- A timeout always wins: even if a handler resolves inside its own `abort`
  listener, the attempt is recorded as a timeout.
- Do not throw from an `abort` listener — the runtime reports listener
  exceptions as uncaught exceptions.
- `OutboxProcessor.stop()` does **not** abort in-flight handlers: it is
  synchronous, in-flight messages finish and write their status afterwards.
  Aborting there would turn every graceful shutdown into counted failed
  attempts.
- Middleware (`OutboxMiddleware`) does not receive the context.
- The context is optional in the type so that `handler.handle(message)` calls in
  your own tests still compile. A test that asserts
  `expect(handle).toHaveBeenCalledWith(message)` must now expect the context
  too.
- A `resetStaleProcessing` mock asserted with `toHaveBeenCalledWith(date)` must
  now expect the options argument too.

### Observing timeouts

```typescript
new OutboxProcessor(repo, {
  hooks: {
    // handler exceeded its timeout (it may still be running); normally followed by onMessageFailed
    onHandlerTimeout: (message, { timeoutMs, attempt }) =>
      metrics.inc('outbox_timeout', { type: message.messageType }),
    // the timed-out handler finally settled; lateMs = time since the timeout
    onLateSettle: (message, outcome, lateMs) =>
      metrics.observe('outbox_late_settle_ms', lateMs, { outcome }),
  },
});
```

Hooks may be `async`; a rejection is logged and never becomes an unhandled
rejection. A throwing hook is isolated the same way.

### Crash recovery and `attempts`

Crash recovery is **opt-in**: set `crashRecoveryIntervalMs`, otherwise a message
that is left `PROCESSING` stays that way forever.

`resetStaleProcessing(olderThan, options?)` receives
`{ messageTypes, maxRetries }` from the processor (`messageTypes` only when the
processor has an allow-list). The one-parameter form of your override keeps
working.

- With several processors on one table, **filter by `options.messageTypes`**;
  each processor only knows its own timeouts, so an unfiltered reset can reclaim
  messages another processor is still handling.
- **Recovery does not touch `attempts`.** The processor increments it only when
  a handler throws or times out. A message that kills its worker every time
  (OOM, SIGKILL) is therefore recovered forever and never reaches `FAILED`. If
  that matters, increment `attempts` inside your `resetStaleProcessing` and move
  rows with `attempts >= options.maxRetries` to `FAILED` (the processor will not
  fire `onPermanentFailure` for them).

## Claim fencing (opt-in)

Timeouts, slow repository calls and crash recovery can make a message be claimed
again while a previous attempt is still alive. Without fencing that attempt's
late status write overwrites the newer attempt's state. With `useFencing: true`
every status write of an attempt is applied **only while that attempt still
holds its claim**.

```typescript
const processor = new OutboxProcessor(repo, {
  useFencing: true,
  maxRetries: 5,
});
```

What your repository must provide — the constructor throws `TypeError` if
anything is missing (there is no silent fallback):

- `completeFenced(id, token)`, `recordFailureFenced(id, token, error)` and
  `releaseFenced(id, token, { status, processAfter?, error? })` — each ONE
  conditional statement returning whether it applied.
  `satisfies FencedOutboxRepository` checks this at compile time.
- An **overridden** `claimBatch` that sets a fresh, unique `claimToken` on every
  claimed message and persists it. The inherited default sets none, and the
  constructor rejects a repository that does not override it. A claimed message
  that still comes back without a token is skipped and logged (it stays
  `PROCESSING` until crash recovery).
- `resetStaleProcessing` that clears the token when it resets a row.

Checking `status = 'PROCESSING'` alone is **not** enough: a re-claim makes the
status `PROCESSING` again (ABA). The token identifies the claim.

Handlers and hooks never receive the claim token (the processor keeps it
internally); do not log or serialise it anyway.

Postgres recipe (documentation only — the library ships no adapter):

```sql
-- claimBatch: a fresh token per claim; honour priorityOrder and messageTypes.
-- Map the returned claim_token column to the message's `claimToken`.
UPDATE outbox SET status = 'PROCESSING', claim_token = gen_random_uuid(), updated_at = now()
WHERE id IN (
  SELECT id FROM outbox
  WHERE status = 'PENDING'
    AND (process_after IS NULL OR process_after <= now())
    AND ($3::text[] IS NULL OR message_type = ANY($3))
  ORDER BY array_position($2::text[], priority), created_at   -- $2 = priorityOrder values
  LIMIT $1 FOR UPDATE SKIP LOCKED
) RETURNING *;

-- completeFenced: rowCount = 1 → applied
UPDATE outbox SET status = 'PROCESSED', claim_token = NULL, updated_at = now()
WHERE id = $1 AND status = 'PROCESSING' AND claim_token = $2;

-- recordFailureFenced ($3 = error.message): no row → return null
UPDATE outbox SET attempts = attempts + 1, last_error = $3, updated_at = now()
WHERE id = $1 AND status = 'PROCESSING' AND claim_token = $2 RETURNING attempts;

-- releaseFenced: ONE statement sets the retry delay too
-- ($4 = processAfter or NULL — NULL clears the delay; $5 = error.message or NULL)
UPDATE outbox SET status = $3, process_after = $4, last_error = COALESCE($5, last_error),
                  claim_token = NULL, updated_at = now()
WHERE id = $1 AND status = 'PROCESSING' AND claim_token = $2;

-- resetStaleProcessing ($2 = options.messageTypes or NULL): also clear the token
UPDATE outbox SET status = 'PENDING', claim_token = NULL
WHERE status = 'PROCESSING' AND updated_at < $1
  AND ($2::text[] IS NULL OR message_type = ANY($2));
```

A write that finds the claim gone is a **stale write**: it is not an error, the
attempt's result is discarded, and
`onStaleWrite(message, 'complete' | 'recordFailure' | 'release')` fires.

- A stale `'complete'` or `'recordFailure'` write changes nothing.
- A stale `'release'` means the failure had already been recorded (`attempts`
  incremented, `onMessageFailed` fired); only the status change and
  `onPermanentFailure` are discarded.

**Fencing protects the status row only.** A handler that is still running (for
example after a timeout) can still perform its side effects — keep them
idempotent (see "Idempotent consumers").

### A failing status write after a successful handler

By default (unchanged behaviour) a failing `PROCESSED` write is treated like any
other failure of the attempt: an attempt is counted, `onMessageFailed` fires
and, after `maxRetries`, the message can end up `FAILED` — **even though the
handler did deliver it**. If that matters, opt in with
`isolateCompletionWriteFailures: true` (implied by `useFencing`):

```typescript
new OutboxProcessor(repo, {
  isolateCompletionWriteFailures: true,
  maxRetries: 5,
});
```

With the flag, such a failure is **not** a handler failure: no attempt is
consumed, `onMessageFailed` does not fire, and the message can never end up
`FAILED` for a delivery that happened. Instead:

1. The processor checks whether the write actually committed (a lost
   acknowledgement). Fenced: the fence rejects a release of a committed row.
   Unfenced: it reads the row back first.
2. Otherwise it releases the message to `PENDING` — with the retry backoff when
   `retryBackoff` is set — so it is delivered again. This is bounded: after
   `maxRetries` such re-deliveries (counted per message, in this process) the
   processor stops releasing and leaves the message `PROCESSING` for crash
   recovery. A failing closing release is retried once.
3. `onCompletionWriteFailed(message, error, { consecutiveFailures, released })`
   fires for every failure. **Alert on it**: the handler's side effects repeat
   with each re-delivery. It is counted in `onBatchComplete.failed`.

Without fencing the release is not protected by a claim token, so a write that
fails in a way the read-back cannot see (the read-back itself fails) can still
overwrite a newer state. Prefer fencing where this matters.

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
