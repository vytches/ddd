import type { IEventBus } from '@vytches/ddd-contracts';
import { LibUtils, safeRun } from '@vytches/ddd-utils';
import { internalLogger } from '@vytches/ddd-contracts/internal';
import type {
  IOutboxMessage,
  IOutboxMessageHandler,
  OutboxHandlerRegistrationOptions,
  OutboxMiddleware,
} from './outbox-interfaces';
import { MessagePriority, MessageStatus } from './outbox-interfaces';
import type { IOutboxRepository, ResetStaleProcessingOptions } from './outbox-repository.interface';
import type { OutboxProcessorHooks } from './outbox-hooks';
import { runHandlerWithTimeout } from './outbox-handler-runner';

/** `setTimeout` fires immediately for delays above this (2^31 - 1). */
const MAX_TIMER_MS = 2_147_483_647;
const DEFAULT_CRASH_RECOVERY_FLOOR_MS = 300_000;

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
   * failure). Each invocation is isolated in a try/catch — a throwing hook is
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
}

type ResolvedOptions = Required<
  Omit<
    OutboxProcessorOptions,
    'retryBackoff' | 'messageTypes' | 'crashRecoveryIntervalMs' | 'hooks'
  >
> & {
  retryBackoff: RetryBackoffConfig | undefined;
  messageTypes: string[] | undefined;
  crashRecoveryIntervalMs: number | undefined;
  hooks: OutboxProcessorHooks | undefined;
};

export class OutboxProcessor {
  private readonly repository: IOutboxRepository;
  private readonly options: ResolvedOptions;
  private readonly handlers = new Map<string, IOutboxMessageHandler>();
  private defaultHandler?: IOutboxMessageHandler;
  /** Per-type timeout overrides (only types registered with `messageTimeoutMs`). */
  private readonly handlerTimeouts = new Map<string, number>();
  private defaultHandlerTimeoutMs?: number | undefined;
  /** The user-supplied threshold; `undefined` means "derive from the largest timeout". */
  private readonly explicitCrashRecoveryThresholdMs: number | undefined;
  private readonly middlewares: OutboxMiddleware[] = [];
  private isRunning = false;
  private processingTimer?: NodeJS.Timeout | undefined;
  private crashRecoveryTimer?: NodeJS.Timeout | undefined;
  /** Guards the one-time fallback warning when `useClaimBatch` is set but the repository has no `claimBatch`. */
  private warnedMissingClaimBatch = false;

  constructor(repository: IOutboxRepository, options: OutboxProcessorOptions = {}) {
    const batchSize = options.batchSize ?? 10;
    if (batchSize > 10_000) {
      throw new RangeError(`OutboxProcessor: batchSize must be ≤ 10,000, got ${batchSize}`);
    }

    if (options.retryBackoff) {
      const { initial, multiplier, maxDelay } = options.retryBackoff;
      if (initial <= 0 || multiplier <= 0 || maxDelay <= 0) {
        throw new RangeError(
          `OutboxProcessor: retryBackoff fields must be positive numbers (initial=${initial}, multiplier=${multiplier}, maxDelay=${maxDelay})`
        );
      }
    }

    const messageTimeout = options.messageTimeout ?? 30000;
    // D3: a too-small crash-recovery threshold would reset messages that are
    // still legitimately in-flight. Default to max(5min, messageTimeout) so the
    // invariant always holds out of the box; reject only explicit unsafe values.
    const crashRecoveryThresholdMs =
      options.crashRecoveryThresholdMs ?? Math.max(DEFAULT_CRASH_RECOVERY_FLOOR_MS, messageTimeout);
    if (crashRecoveryThresholdMs < messageTimeout) {
      throw new RangeError(
        `OutboxProcessor: crashRecoveryThresholdMs (${crashRecoveryThresholdMs}) must be ≥ messageTimeout (${messageTimeout}) to avoid resetting in-flight messages`
      );
    }

    this.repository = repository;
    this.explicitCrashRecoveryThresholdMs = options.crashRecoveryThresholdMs;
    this.options = {
      batchSize,
      maxRetries: options.maxRetries ?? 3,
      processingInterval: options.processingInterval ?? 5000,
      priorityOrder: options.priorityOrder ?? [
        MessagePriority.CRITICAL,
        MessagePriority.HIGH,
        MessagePriority.NORMAL,
        MessagePriority.LOW,
      ],
      messageTimeout,
      enableLogging: options.enableLogging ?? false,
      retryBackoff: options.retryBackoff,
      messageTypes: options.messageTypes,
      crashRecoveryIntervalMs: options.crashRecoveryIntervalMs,
      crashRecoveryThresholdMs,
      adaptiveRepoll: options.adaptiveRepoll ?? false,
      adaptiveRepollMaxConsecutive: options.adaptiveRepollMaxConsecutive ?? 5,
      adaptiveRepollPauseMs: options.adaptiveRepollPauseMs ?? 50,
      startupJitterMs: options.startupJitterMs ?? 0,
      hooks: options.hooks,
      useClaimBatch: options.useClaimBatch ?? false,
    };
  }

  /**
   * Invokes an observability hook in isolation. A throwing hook is logged and
   * swallowed so it can never break the processing loop (mitigation T3).
   */
  private safelyInvokeHook(name: string, invoke: () => void): void {
    if (!this.options.hooks) {
      return;
    }
    try {
      invoke();
    } catch (error) {
      internalLogger.error(
        `OutboxProcessor: hook ${name} threw and was ignored`,
        error instanceof Error ? error : undefined,
        { hookName: name }
      );
    }
  }

  /**
   * Registers a message handler for a specific message type.
   *
   * @param options `messageTimeoutMs` overrides the processor-wide
   *   `messageTimeout` for this type. Re-registering a type replaces both the
   *   handler and its timeout (omitting the option reverts to the default).
   * @throws RangeError if `messageTimeoutMs` is invalid, or exceeds an explicit
   *   `crashRecoveryThresholdMs` (the handler is then not registered).
   */
  registerHandler(
    messageType: string,
    handler: IOutboxMessageHandler,
    options?: OutboxHandlerRegistrationOptions
  ): void {
    const timeoutMs = this.validateHandlerTimeout(messageType, options);
    this.handlers.set(messageType, handler);
    if (timeoutMs === undefined) {
      this.handlerTimeouts.delete(messageType);
    } else {
      this.handlerTimeouts.set(messageType, timeoutMs);
    }
  }

  /**
   * Registers a catch-all handler invoked when no type-specific handler matches.
   *
   * NOTE: Registering a default handler removes the implicit type allowlist —
   * all future message types, including ones added by mistake or injected via
   * compromised storage, will be dispatched to this handler. Validate
   * `message.messageType` inside the handler against a known-types set if your
   * domain requires an explicit allowlist.
   *
   * NOTE: When `messageTypes` filter option is set, the default handler handles
   * only types that pass through that filter. To handle all types, leave
   * `messageTypes` unset.
   *
   * Second/subsequent call emits a warning and replaces the previous handler.
   */
  registerDefaultHandler(
    handler: IOutboxMessageHandler,
    options?: OutboxHandlerRegistrationOptions
  ): void {
    const timeoutMs = this.validateHandlerTimeout('<default>', options);
    if (this.defaultHandler) {
      internalLogger.warn(
        'registerDefaultHandler: replacing existing default handler — previous handler discarded'
      );
    }
    this.defaultHandler = handler;
    this.defaultHandlerTimeoutMs = timeoutMs;
  }

  /** Validates a per-handler timeout; returns it, or `undefined` when not set. */
  private validateHandlerTimeout(
    label: string,
    options: OutboxHandlerRegistrationOptions | undefined
  ): number | undefined {
    const timeoutMs = options?.messageTimeoutMs;
    if (timeoutMs === undefined) {
      return undefined;
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMER_MS) {
      throw new RangeError(
        `OutboxProcessor: messageTimeoutMs for '${label}' must be a positive number ≤ ${MAX_TIMER_MS}, got ${timeoutMs}`
      );
    }
    const explicit = this.explicitCrashRecoveryThresholdMs;
    if (explicit !== undefined && explicit < timeoutMs) {
      throw new RangeError(
        `OutboxProcessor: crashRecoveryThresholdMs (${explicit}) must be ≥ messageTimeoutMs (${timeoutMs}) of '${label}' to avoid resetting in-flight messages`
      );
    }
    return timeoutMs;
  }

  /** Timeout that applies to a message type (override of the handler that will run it, else default). */
  private resolveTimeoutMs(messageType: string): number {
    const override = this.handlers.has(messageType)
      ? this.handlerTimeouts.get(messageType)
      : this.defaultHandlerTimeoutMs;
    return override ?? this.options.messageTimeout;
  }

  /** Largest timeout any registered handler may use — the floor for the recovery threshold. */
  private largestTimeoutMs(): number {
    return Math.max(
      this.options.messageTimeout,
      this.defaultHandlerTimeoutMs ?? 0,
      ...this.handlerTimeouts.values()
    );
  }

  private effectiveCrashRecoveryThresholdMs(): number {
    return (
      this.explicitCrashRecoveryThresholdMs ??
      Math.max(DEFAULT_CRASH_RECOVERY_FLOOR_MS, this.largestTimeoutMs())
    );
  }

  /**
   * Registers middleware for message processing pipeline
   */
  use(middleware: OutboxMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Starts the processor with automatic interval processing
   */
  start(): void {
    if (this.isRunning) {
      internalLogger.warn('OutboxProcessor: processor is already running');
      return;
    }

    this.isRunning = true;
    const jitter =
      this.options.startupJitterMs > 0
        ? Math.floor(Math.random() * this.options.startupJitterMs)
        : 0;
    this.scheduleProcessing(0, this.options.processingInterval + jitter);
    this.scheduleCrashRecovery();
  }

  /**
   * Stops the processor
   */
  stop(): void {
    if (!this.isRunning) {
      internalLogger.warn('OutboxProcessor: processor is not running');
      return;
    }

    this.isRunning = false;
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = undefined;
    }
    if (this.crashRecoveryTimer) {
      clearTimeout(this.crashRecoveryTimer);
      this.crashRecoveryTimer = undefined;
    }
  }

  /**
   * Processes a single batch of pending messages.
   *
   * **Dispatch model:** messages within a batch are dispatched **in parallel**
   * via `Promise.allSettled`. A failure in message N does **not** block
   * messages N+1..N+M. Each failure is isolated, retry-counted via
   * `incrementAttempt`, and reset to `PENDING` (or marked `FAILED` after
   * `maxRetries` attempts) — independently of sibling messages.
   *
   * **Ordering:** parallel dispatch means message processing order is
   * **not guaranteed** within a batch, even if `priorityOrder` was used to
   * select which messages to fetch. If you need strict ordering, set
   * `batchSize: 1` (one message per batch = sequential by definition).
   *
   * **Throughput:** for N messages and dispatch latency L, total batch time
   * is approximately L (parallel) rather than N*L (sequential). For 200
   * messages at 10ms dispatch each: ~10ms parallel vs ~2s sequential.
   *
   * **Quiescence:** if there are no pending messages, returns immediately
   * without invoking handlers.
   *
   * @returns `{ processed, batchSize }` — `processed` is how many messages were
   *   dispatched this batch, `batchSize` the configured limit. A full batch
   *   (`processed >= batchSize`) signals a likely backlog. Callers that ignore
   *   the return value are unaffected (the value was previously `void`).
   * @public
   * @stable
   * @since 0.1.0
   */
  async processBatch(): Promise<{ processed: number; batchSize: number }> {
    const batchSize = this.options.batchSize;

    if (!this.isRunning) {
      return { processed: 0, batchSize };
    }

    // AC#1: when useClaimBatch is enabled and the repository provides an
    // atomic claimBatch(), use it — the returned messages are already marked
    // PROCESSING by the repository, closing the read-then-mark race window
    // that exists with plain getUnprocessedMessages(). Falls back to
    // getUnprocessedMessages() (with a one-time warning) if the repository
    // has no claimBatch at all.
    const claimFn = this.repository.claimBatch;
    const useClaim = this.options.useClaimBatch === true && typeof claimFn === 'function';
    if (this.options.useClaimBatch && !useClaim && !this.warnedMissingClaimBatch) {
      this.warnedMissingClaimBatch = true;
      internalLogger.warn(
        'OutboxProcessor: useClaimBatch is enabled but the repository does not implement claimBatch() — falling back to getUnprocessedMessages (no atomic-claim protection)'
      );
    }

    const [error, result] = await safeRun(() =>
      useClaim && claimFn
        ? claimFn.call(
            this.repository,
            batchSize,
            this.options.priorityOrder,
            this.options.messageTypes
          )
        : this.repository.getUnprocessedMessages(
            batchSize,
            this.options.priorityOrder,
            this.options.messageTypes
          )
    );

    if (error) {
      internalLogger.error(
        'OutboxProcessor: error retrieving messages',
        error instanceof Error ? error : undefined
      );
      return { processed: 0, batchSize };
    }

    const messages = result;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return { processed: 0, batchSize };
    }

    const startedAt = Date.now();

    // Parallel dispatch via Promise.allSettled — failures in any message do
    // NOT short-circuit the batch. Each message has its own retry/fail state
    // tracked in the repository (see handleMessageError).
    const outcomes = await Promise.allSettled(
      messages.map(message => this.processMessage(message, useClaim))
    );

    // processMessage never rejects (it catches internally), but treat any
    // rejection defensively as a failure for hook accounting.
    const failed = outcomes.filter(
      o => o.status === 'rejected' || (o.status === 'fulfilled' && o.value === false)
    ).length;

    this.safelyInvokeHook('onBatchComplete', () =>
      this.options.hooks?.onBatchComplete?.({
        processed: messages.length,
        failed,
        batchSize,
        durationMs: Date.now() - startedAt,
      })
    );

    return { processed: messages.length, batchSize };
  }

  /**
   * Processes a single message through the middleware pipeline.
   * @param alreadyClaimed When `true`, the message was already marked
   *   `PROCESSING` by `IOutboxRepository.claimBatch()` — the redundant
   *   `updateStatus(id, PROCESSING)` call is skipped.
   * @returns `true` if the message was processed successfully, `false` if it failed.
   */
  private async processMessage(message: IOutboxMessage, alreadyClaimed = false): Promise<boolean> {
    const [error] = await safeRun(async () => {
      // Mark as processing (skipped when claimBatch already did this atomically)
      if (!alreadyClaimed) {
        await this.repository.updateStatus(message.id, MessageStatus.PROCESSING);
      }

      // Build middleware pipeline
      const pipeline = this.buildPipeline(message);
      await pipeline(message);

      // Mark as processed
      await this.repository.updateStatus(message.id, MessageStatus.PROCESSED);
    });

    if (error) {
      await this.handleMessageError(message, error);
      return false;
    }
    return true;
  }

  /**
   * Builds the middleware pipeline for message processing
   */
  private buildPipeline(message: IOutboxMessage): (msg: IOutboxMessage) => Promise<void> {
    const handler = this.handlers.get(message.messageType) ?? this.defaultHandler;
    if (!handler) {
      throw new Error(`No handler registered for message type: ${message.messageType}`);
    }
    // Create the final handler function
    const finalHandler = (msg: IOutboxMessage): Promise<void> =>
      runHandlerWithTimeout(handler, msg, this.resolveTimeoutMs(msg.messageType), {
        onTimeout: info =>
          this.safelyInvokeHook('onHandlerTimeout', () =>
            this.options.hooks?.onHandlerTimeout?.(msg, info)
          ),
        onLateSettle: (outcome, lateMs) =>
          this.safelyInvokeHook('onLateSettle', () =>
            this.options.hooks?.onLateSettle?.(msg, outcome, lateMs)
          ),
      });

    // Build the middleware chain from right to left
    return this.middlewares.reduceRight((next, middleware) => middleware(next), finalHandler);
  }

  /**
   * Handles errors during message processing
   */
  private async handleMessageError(message: IOutboxMessage, error: Error): Promise<void> {
    try {
      const attempts = await this.repository.incrementAttempt(message.id);
      // VS-018: sanitize error.message before interpolation — a handler may
      // embed untrusted data in a thrown error, which would otherwise be a
      // log-injection vector (forged log lines via embedded \r/\n).
      internalLogger.warn(
        `OutboxProcessor: message ${message.id} failed, attempt ${attempts}: ${LibUtils.sanitizeLogMessage(error?.message ?? String(error))}`
      );

      this.safelyInvokeHook('onMessageFailed', () =>
        this.options.hooks?.onMessageFailed?.(message, error, attempts)
      );

      if (attempts >= this.options.maxRetries) {
        await this.repository.updateStatus(message.id, MessageStatus.FAILED, error);
        internalLogger.error('OutboxProcessor: message permanently failed', error, {
          messageId: message.id,
          attempts,
        });
        this.safelyInvokeHook('onPermanentFailure', () =>
          this.options.hooks?.onPermanentFailure?.(message, error)
        );
      } else if (this.options.retryBackoff) {
        const { initial, multiplier, maxDelay } = this.options.retryBackoff;
        const delay = Math.min(initial * Math.pow(multiplier, attempts - 1), maxDelay);
        const processAfter = new Date(Date.now() + delay);
        // Reset to PENDING first so the message is never stuck in PROCESSING
        // if the repository's scheduleRetry is the inherited no-op.
        await this.repository.updateStatus(message.id, MessageStatus.PENDING);
        await this.repository.scheduleRetry(message.id, processAfter);
      } else {
        // No backoff configured: immediate retry (legacy behavior)
        await this.repository.updateStatus(message.id, MessageStatus.PENDING);
      }
    } catch (updateError) {
      internalLogger.error(
        'OutboxProcessor: error updating message status',
        updateError instanceof Error ? updateError : undefined,
        { messageId: message.id }
      );
    }
  }

  /**
   * Schedules the next processing cycle.
   *
   * With `adaptiveRepoll` enabled, a full batch re-polls immediately (`delay 0`)
   * to drain a backlog — until `adaptiveRepollMaxConsecutive` consecutive full
   * batches trip the livelock guard, after which an `adaptiveRepollPauseMs`
   * pause is inserted. Any non-full batch resets the cadence to
   * `processingInterval`.
   *
   * @param consecutiveFullBatches running count of back-to-back full batches
   * @param delay milliseconds to wait before the next batch
   */
  private scheduleProcessing(
    consecutiveFullBatches = 0,
    delay: number = this.options.processingInterval
  ): void {
    if (!this.isRunning) {
      return;
    }

    this.processingTimer = setTimeout(async () => {
      const result = await this.processBatch();

      const isFullBatch =
        this.options.adaptiveRepoll && result.processed > 0 && result.processed >= result.batchSize;

      if (isFullBatch) {
        const consecutive = consecutiveFullBatches + 1;
        const nextDelay =
          consecutive > this.options.adaptiveRepollMaxConsecutive
            ? this.options.adaptiveRepollPauseMs
            : 0;
        this.scheduleProcessing(consecutive, nextDelay);
      } else {
        this.scheduleProcessing(0, this.options.processingInterval);
      }
    }, delay);
  }

  /**
   * Schedules the next crash-recovery cycle. No-op unless
   * `crashRecoveryIntervalMs` was configured.
   */
  private scheduleCrashRecovery(): void {
    if (!this.isRunning || this.options.crashRecoveryIntervalMs === undefined) {
      return;
    }

    this.crashRecoveryTimer = setTimeout(async () => {
      await this.runCrashRecovery();
      this.scheduleCrashRecovery();
    }, this.options.crashRecoveryIntervalMs);
  }

  /**
   * Resets messages orphaned in `PROCESSING` (older than
   * `crashRecoveryThresholdMs`) back to `PENDING` via the repository. Errors are
   * logged, never thrown — crash recovery must not crash the processor.
   */
  private async runCrashRecovery(): Promise<void> {
    const olderThan = new Date(Date.now() - this.effectiveCrashRecoveryThresholdMs());
    const recoveryOptions: ResetStaleProcessingOptions = {
      maxRetries: this.options.maxRetries,
      ...(this.options.messageTypes ? { messageTypes: [...this.options.messageTypes] } : {}),
    };
    const [error, count] = await safeRun(() =>
      this.repository.resetStaleProcessing(olderThan, recoveryOptions)
    );

    if (error) {
      internalLogger.error(
        'OutboxProcessor: crash recovery failed',
        error instanceof Error ? error : undefined
      );
      return;
    }

    if (count && count > 0) {
      internalLogger.warn(
        `OutboxProcessor: crash recovery reset ${count} stale PROCESSING message(s) to PENDING`
      );
    }
  }

  /**
   * Gets processor statistics
   */
  async getStats(): Promise<{
    isRunning: boolean;
    batchSize: number;
    maxRetries: number;
    processingInterval: number;
    registeredHandlers: string[];
    middlewareCount: number;
    hasDefaultHandler: boolean;
  }> {
    return {
      isRunning: this.isRunning,
      batchSize: this.options.batchSize,
      maxRetries: this.options.maxRetries,
      processingInterval: this.options.processingInterval,
      registeredHandlers: Array.from(this.handlers.keys()),
      middlewareCount: this.middlewares.length,
      hasDefaultHandler: this.defaultHandler !== undefined,
    };
  }
}

export class EventBusOutboxHandler implements IOutboxMessageHandler {
  constructor(private readonly eventBus: IEventBus) {}

  async handle(message: IOutboxMessage): Promise<void> {
    // Extract event name from message type (remove integration_event: prefix if present)
    const eventName = message.messageType.startsWith('integration_event:')
      ? message.messageType.replace('integration_event:', '')
      : message.messageType;

    const eventData = {
      eventName,
      eventId: message.id,
      occurredOn: message.createdAt,
      version: 1,
      ...(message.payload as Record<string, unknown>),
      ...message.metadata,
    };

    await this.eventBus.publish(eventData);
  }
}
