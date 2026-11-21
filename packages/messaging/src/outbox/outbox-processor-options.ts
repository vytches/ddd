import type { MessagePriority } from './outbox-interfaces';
import type { OutboxProcessorHooks } from './outbox-hooks';

export interface RetryBackoffConfig {
  /** Initial delay in milliseconds before first retry (default: 1000) */
  initial: number;
  /** Multiplier applied per subsequent attempt (default: 2) */
  multiplier: number;
  /** Maximum delay cap in milliseconds (default: 300_000 — 5 min) */
  maxDelay: number;
}

export interface OutboxProcessorOptions {
  /** Maximum number of messages to process in one batch */
  batchSize?: number;
  /** Maximum retry attempts for failed messages */
  maxRetries?: number;
  /** Processing interval in milliseconds */
  processingInterval?: number;
  /** Priority order for message processing */
  priorityOrder?: MessagePriority[];
  /**
   * Default timeout (ms) for a single `handler.handle()` call, per message (not per
   * batch). Override per message type via `registerHandler(type, handler,
   * { messageTimeoutMs })`. Covers only the handler — not middleware, claim or
   * status writes. On expiry the handler's `AbortSignal` is aborted with an
   * `OutboxTimeoutError`; a handler that ignores it keeps running and the
   * message may be retried concurrently. Defaults to 30000.
   */
  messageTimeout?: number;
  /** Enable logging */
  enableLogging?: boolean;
  /**
   * Exponential backoff for retries.
   * When set, failed messages are scheduled for future retry via
   * `IOutboxRepository.scheduleRetry()` instead of immediately re-queued.
   * If the repository's `scheduleRetry` is a no-op, messages fall back to
   * immediate PENDING reset (legacy behavior).
   * If omitted, immediate retry is used for all messages.
   */
  retryBackoff?: RetryBackoffConfig;
  /**
   * Optional allow-list of message types to process. When set, only messages
   * of these types are fetched from the repository (passed through to
   * `getUnprocessedMessages`). Lets multiple processors partition the outbox
   * by type. Omit to process all types.
   */
  messageTypes?: string[];
  /**
   * When set, the processor periodically calls
   * `IOutboxRepository.resetStaleProcessing()` every N ms to recover messages
   * orphaned in `PROCESSING` by a crashed worker. Omit to disable crash recovery.
   */
  crashRecoveryIntervalMs?: number;
  /**
   * How old (in ms) a `PROCESSING` message must be before crash recovery resets
   * it to `PENDING`. Must be `>= messageTimeout` (and `>=` every per-handler
   * `messageTimeoutMs`) so legitimately in-flight messages are never reset.
   * Defaults to `max(300_000, largest timeout)`, re-evaluated as handlers with
   * longer timeouts are registered. Setting an explicit value below
   * `messageTimeout` throws a `RangeError` from the constructor; registering a
   * handler whose `messageTimeoutMs` exceeds it throws from `registerHandler`.
   *
   * With several processors on one table, set it to at least the largest timeout
   * of ANY of them — each processor only knows its own.
   */
  crashRecoveryThresholdMs?: number;
  /**
   * When `true`, after a **full** batch (every fetched slot used) the processor
   * re-polls immediately instead of waiting `processingInterval`, draining a
   * backlog faster. Defaults to `false` (opt-in — no behavior change).
   */
  adaptiveRepoll?: boolean;
  /**
   * Livelock guard for `adaptiveRepoll`: after this many consecutive full
   * batches the processor inserts an `adaptiveRepollPauseMs` pause instead of
   * re-polling immediately, yielding the event loop. Defaults to `5`.
   */
  adaptiveRepollMaxConsecutive?: number;
  /**
   * Pause (ms) inserted once the `adaptiveRepollMaxConsecutive` guard trips.
   * Defaults to `50`.
   */
  adaptiveRepollPauseMs?: number;
  /**
   * Random delay (0..N ms) added before the first poll on `start()`, to
   * de-synchronize many processors that boot simultaneously. Defaults to `0`.
   */
  startupJitterMs?: number;
  /**
   * Observability callbacks (batch completion, message failure, permanent
   * failure, handler timeout, late settle, stale write, completion-write
   * failure — see {@link OutboxProcessorHooks}). Each invocation is isolated in a try/catch — a throwing hook is
   * logged and never breaks the processing loop. Omit to disable.
   */
  hooks?: OutboxProcessorHooks;
  /**
   * Opt-in: when `true`, `processBatch` calls `IOutboxRepository.claimBatch()`
   * instead of `getUnprocessedMessages()`, and `processMessage` skips its own
   * (now redundant) `updateStatus(id, PROCESSING)` call for messages obtained
   * this way — the repository's `claimBatch` is responsible for the
   * PROCESSING mark.
   *
   * **Correctness depends on the repository.** `claimBatch` is an optional
   * method on `IOutboxRepository` with a non-atomic default implementation
   * (read then mark, two steps). Setting `useClaimBatch: true` against a
   * repository that has NOT overridden `claimBatch` with a real atomic
   * claim (e.g. `SELECT ... FOR UPDATE SKIP LOCKED`) provides **no**
   * additional safety over the default `getUnprocessedMessages` path — it
   * only prevents duplicate dispatch when the repository's `claimBatch` is
   * genuinely atomic.
   *
   * If the repository does not implement `claimBatch` at all (the method is
   * `undefined`, e.g. a hand-rolled repository predating this option), the
   * processor logs a warning once and falls back to
   * `getUnprocessedMessages` for that batch.
   *
   * Defaults to `false` — no behavior change for existing consumers (AC#5).
   */
  useClaimBatch?: boolean;
  /**
   * Opt-in claim fencing. Every status write of an attempt is applied only while
   * that attempt still holds its claim, so a late writer can never overwrite the
   * outcome of a newer attempt. Implies `useClaimBatch`.
   *
   * Requires a repository that OVERRIDES `claimBatch` (the inherited default sets
   * no token) so it sets a unique `claimToken` per claim, and that implements
   * `completeFenced`, `recordFailureFenced` and `releaseFenced`; the constructor
   * throws `TypeError` otherwise (no silent fallback — it would look protected
   * and not be). A claimed message that still arrives WITHOUT a `claimToken` is
   * skipped and logged as an error (it stays `PROCESSING` until crash recovery
   * resets it — which is opt-in via `crashRecoveryIntervalMs`).
   *
   * Handlers and hooks receive the message WITHOUT the claim token.
   *
   * Fencing protects the status row only; side effects of a handler that is
   * still running are not covered — handlers must stay idempotent.
   *
   * Defaults to `false`.
   */
  useFencing?: boolean;
  /**
   * Opt-in. When the handler SUCCEEDED but writing the `PROCESSED` status fails,
   * do NOT treat it as a handler failure (the default, unchanged behaviour counts
   * an attempt, fires `onMessageFailed` and can end in `FAILED` for a message that
   * was in fact delivered). With this flag: no attempt is consumed; the processor
   * checks whether the write committed (unfenced: reads the row back), otherwise
   * releases the message for re-delivery (with the retry backoff), at most
   * `maxRetries` times per message per process, then leaves it `PROCESSING` for
   * crash recovery; each failure fires `onCompletionWriteFailed`. A failing
   * closing release is also retried once.
   *
   * Implied by `useFencing`. Defaults to `false` — no behaviour change for
   * existing consumers.
   */
  isolateCompletionWriteFailures?: boolean;
}
