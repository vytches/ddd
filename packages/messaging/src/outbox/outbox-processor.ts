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
import { IOutboxRepository } from './outbox-repository.interface';
import type { ResetStaleProcessingOptions } from './outbox-repository.interface';
import type { OutboxProcessorHooks } from './outbox-hooks';
import type { OutboxProcessorOptions, RetryBackoffConfig } from './outbox-processor-options';
import { runHandlerWithTimeout } from './outbox-handler-runner';
import { HandlerTimeoutRegistry } from './outbox-handler-timeouts';
import { OutcomeRecorder, type OutcomeClaim } from './outbox-outcome-recorder';
import {
  FencedOutcomeStore,
  LegacyOutcomeStore,
  isFencedRepository,
  missingFencedMethods,
} from './outbox-outcome-stores';

const DEFAULT_CRASH_RECOVERY_FLOOR_MS = 300_000;

/** Reports (never throws) a pre-existing option value that `setTimeout` cannot honour. */
function warnIfUnusableTimer(option: string, value: number): void {
  try {
    HandlerTimeoutRegistry.assertTimerMs(option, value);
  } catch (error) {
    internalLogger.warn(
      `${error instanceof Error ? error.message : String(error)} — it is used as given and will behave as a ~1 ms timer; this will be rejected in a future major version`
    );
  }
}

export type { RetryBackoffConfig, OutboxProcessorOptions } from './outbox-processor-options';

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
  private readonly timeouts: HandlerTimeoutRegistry;
  private readonly recorder: OutcomeRecorder;
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
    // Pre-existing options are never rejected (that would change behaviour for
    // existing consumers): a value `setTimeout` cannot honour is only reported.
    warnIfUnusableTimer('messageTimeout', messageTimeout);
    if (options.crashRecoveryThresholdMs !== undefined) {
      warnIfUnusableTimer('crashRecoveryThresholdMs', options.crashRecoveryThresholdMs);
    }
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

    if (options.useFencing) {
      this.assertFencingCapable(repository);
    }

    this.repository = repository;
    this.recorder = new OutcomeRecorder({
      isolateCompletionWriteFailures:
        (options.isolateCompletionWriteFailures ?? false) || (options.useFencing ?? false),
      store:
        options.useFencing && isFencedRepository(repository)
          ? new FencedOutcomeStore(repository)
          : new LegacyOutcomeStore(repository),
      maxRetries: options.maxRetries ?? 3,
      retryAt: attempts => this.retryAt(attempts),
      emit: (hook, call) =>
        this.safelyInvokeHook(hook, () =>
          this.options.hooks ? call(this.options.hooks) : undefined
        ),
    });
    this.timeouts = new HandlerTimeoutRegistry(messageTimeout, options.crashRecoveryThresholdMs);
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
      useFencing: options.useFencing ?? false,
      isolateCompletionWriteFailures:
        (options.isolateCompletionWriteFailures ?? false) || (options.useFencing ?? false),
    };
  }

  /** `useFencing` is a correctness feature: misconfiguration fails loudly instead of falling back. */
  private assertFencingCapable(repository: IOutboxRepository): void {
    const missing = missingFencedMethods(repository);
    if (missing.length > 0) {
      throw new TypeError(
        `OutboxProcessor: useFencing requires the repository to implement ${missing.join(', ')}`
      );
    }
    // The inherited default claimBatch is a non-atomic shim that sets no token:
    // every message would then be skipped on every poll.
    if (
      typeof repository.claimBatch !== 'function' ||
      repository.claimBatch === IOutboxRepository.prototype.claimBatch
    ) {
      throw new TypeError(
        'OutboxProcessor: useFencing requires the repository to override claimBatch() so that it sets a unique claimToken on every claimed message (the inherited default sets none)'
      );
    }
  }

  /** Backoff instant for a retry after `attempts` failures; `undefined` without `retryBackoff`. */
  private retryAt(attempts: number): Date | undefined {
    if (!this.options.retryBackoff) {
      return undefined;
    }
    const { initial, multiplier, maxDelay } = this.options.retryBackoff;
    return new Date(Date.now() + Math.min(initial * Math.pow(multiplier, attempts - 1), maxDelay));
  }

  /**
   * Invokes an observability hook in isolation. A throwing hook is logged and
   * swallowed so it can never break the processing loop (mitigation T3).
   */
  private safelyInvokeHook(name: string, invoke: () => unknown): void {
    if (!this.options.hooks) {
      return;
    }
    try {
      const result = invoke();
      // An `async` hook that rejects would otherwise be an unhandled rejection.
      if (
        result !== null &&
        typeof result === 'object' &&
        typeof (result as PromiseLike<unknown>).then === 'function'
      ) {
        (result as PromiseLike<unknown>).then(undefined, (error: unknown) =>
          this.logHookError(name, error)
        );
      }
    } catch (error) {
      this.logHookError(name, error);
    }
  }

  private logHookError(name: string, error: unknown): void {
    internalLogger.error(
      `OutboxProcessor: hook ${name} threw and was ignored`,
      error instanceof Error ? error : undefined,
      { hookName: name }
    );
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
    const timeoutMs = this.timeouts.validate(messageType, options?.messageTimeoutMs);
    this.handlers.set(messageType, handler);
    this.timeouts.setForType(messageType, timeoutMs);
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
    const timeoutMs = this.timeouts.validate('<default>', options?.messageTimeoutMs);
    if (this.defaultHandler) {
      internalLogger.warn(
        'registerDefaultHandler: replacing existing default handler — previous handler discarded'
      );
    }
    this.defaultHandler = handler;
    this.timeouts.setForDefaultHandler(timeoutMs);
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
   * messages N+1..N+M. Each handler failure is isolated, attempt-counted
   * (`incrementAttempt`, or `recordFailureFenced` with `useFencing`), and
   * released to `PENDING` (or `FAILED` after `maxRetries` attempts) —
   * independently of sibling messages. A failing STATUS write after a
   * successful handler counts as a handler failure unless
   * `isolateCompletionWriteFailures` / `useFencing` is set (see `onCompletionWriteFailed`).
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
    const wantsClaim = this.options.useClaimBatch || this.options.useFencing;
    const useClaim = wantsClaim && typeof claimFn === 'function';
    if (wantsClaim && !useClaim && !this.warnedMissingClaimBatch) {
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

    if (!result || !Array.isArray(result) || result.length === 0) {
      return { processed: 0, batchSize };
    }

    const messages = this.options.useFencing ? this.withClaimTokens(result) : result;
    if (messages.length === 0) {
      return { processed: 0, batchSize };
    }

    const startedAt = Date.now();

    // Parallel dispatch via Promise.allSettled — failures in any message do
    // NOT short-circuit the batch. Each message has its own retry/fail state
    // tracked in the repository (see OutcomeRecorder).
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
   * With fencing, drops claimed messages that carry no `claimToken` (a
   * repository contract violation) instead of dispatching them unprotected.
   */
  private withClaimTokens(claimed: IOutboxMessage[]): IOutboxMessage[] {
    const tokened = claimed.filter(message => Boolean(message.claimToken));
    const skipped = claimed.length - tokened.length;
    if (skipped > 0) {
      internalLogger.error(
        'OutboxProcessor: useFencing is enabled but claimBatch returned messages without claimToken — skipped, left in PROCESSING for crash recovery',
        undefined,
        { skipped, firstMessageId: claimed.find(message => !message.claimToken)?.id }
      );
    }
    return tokened;
  }

  /**
   * Processes a single message through the middleware pipeline.
   * @param alreadyClaimed When `true`, the message was already marked
   *   `PROCESSING` by `IOutboxRepository.claimBatch()` — the redundant
   *   `updateStatus(id, PROCESSING)` call is skipped.
   * @returns `true` if the message was processed successfully, `false` if it failed.
   */
  private async processMessage(message: IOutboxMessage, alreadyClaimed = false): Promise<boolean> {
    const fenced = this.options.useFencing;
    let claim: OutcomeClaim = { message };
    if (fenced) {
      // Handlers and hooks never see the claim token (it is the fence's credential).
      const { claimToken, ...visible } = message;
      if (!claimToken) {
        return false; // filtered out in processBatch; defensive
      }
      claim = { message: visible, claimToken };
    }
    const target = claim.message;

    const [error] = await safeRun(async () => {
      // Mark as processing (skipped when claimBatch already did this atomically)
      if (!fenced && !alreadyClaimed) {
        await this.repository.updateStatus(target.id, MessageStatus.PROCESSING);
      }
      await this.buildPipeline(target)(target);
    });

    if (error) {
      await this.recorder.failed(claim, error);
      return false;
    }
    return this.recorder.succeeded(claim);
  }

  /**
   * Builds the middleware pipeline for message processing
   */
  private buildPipeline(message: IOutboxMessage): (msg: IOutboxMessage) => Promise<void> {
    const handler = this.handlers.get(message.messageType) ?? this.defaultHandler;
    if (!handler) {
      throw new Error(`No handler registered for message type: ${message.messageType}`);
    }
    // Resolve the timeout together with the handler so both come from the same registration.
    const timeoutMs = this.timeouts.resolve(
      message.messageType,
      this.handlers.has(message.messageType)
    );
    const finalHandler = (msg: IOutboxMessage): Promise<void> =>
      runHandlerWithTimeout(handler, msg, timeoutMs, {
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
    const olderThan = new Date(Date.now() - this.timeouts.crashRecoveryThresholdMs());
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
