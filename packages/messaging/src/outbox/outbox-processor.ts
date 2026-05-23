import type { IEventBus } from '@vytches/ddd-contracts';
import { Logger } from '@vytches/ddd-logging';
import { safeRun } from '@vytches/ddd-utils';
import type { IOutboxMessage, IOutboxMessageHandler, OutboxMiddleware } from './outbox-interfaces';
import { MessagePriority, MessageStatus } from './outbox-interfaces';
import type { IOutboxRepository } from './outbox-repository.interface';

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
  /** Timeout for processing a single message */
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
   * it to `PENDING`. Must be `>= messageTimeout` so legitimately in-flight
   * messages are never reset. Defaults to `max(300_000, messageTimeout)`.
   * Setting this below `messageTimeout` throws a `RangeError` from the constructor.
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
}

type ResolvedOptions = Required<
  Omit<OutboxProcessorOptions, 'retryBackoff' | 'messageTypes' | 'crashRecoveryIntervalMs'>
> & {
  retryBackoff: RetryBackoffConfig | undefined;
  messageTypes: string[] | undefined;
  crashRecoveryIntervalMs: number | undefined;
};

export class OutboxProcessor {
  private readonly repository: IOutboxRepository;
  private readonly options: ResolvedOptions;
  private readonly handlers = new Map<string, IOutboxMessageHandler>();
  private readonly middlewares: OutboxMiddleware[] = [];
  private isRunning = false;
  private processingTimer?: NodeJS.Timeout | undefined;
  private crashRecoveryTimer?: NodeJS.Timeout | undefined;
  private readonly logger = Logger.create('OutboxProcessor');

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
      options.crashRecoveryThresholdMs ?? Math.max(300_000, messageTimeout);
    if (crashRecoveryThresholdMs < messageTimeout) {
      throw new RangeError(
        `OutboxProcessor: crashRecoveryThresholdMs (${crashRecoveryThresholdMs}) must be ≥ messageTimeout (${messageTimeout}) to avoid resetting in-flight messages`
      );
    }

    this.repository = repository;
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
    };
  }

  /**
   * Registers a message handler for a specific message type
   */
  registerHandler(messageType: string, handler: IOutboxMessageHandler): void {
    this.handlers.set(messageType, handler);
    this.logger.debug(`Registered handler for message type: ${messageType}`);
  }

  /**
   * Registers middleware for message processing pipeline
   */
  use(middleware: OutboxMiddleware): void {
    this.middlewares.push(middleware);
    this.logger.debug('Registered middleware');
  }

  /**
   * Starts the processor with automatic interval processing
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Processor is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting outbox processor');
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
      this.logger.warn('Processor is not running');
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
    this.logger.info('Stopped outbox processor');
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

    const [error, result] = await safeRun(() =>
      this.repository.getUnprocessedMessages(
        batchSize,
        this.options.priorityOrder,
        this.options.messageTypes
      )
    );

    if (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error retrieving messages: ${errorMessage}`);
      return { processed: 0, batchSize };
    }

    const messages = result;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      this.logger.debug('No pending messages to process');
      return { processed: 0, batchSize };
    }

    this.logger.info(`Processing ${messages.length} messages`);

    // Parallel dispatch via Promise.allSettled — failures in any message do
    // NOT short-circuit the batch. Each message has its own retry/fail state
    // tracked in the repository (see handleMessageError).
    const processingPromises = messages.map(message => this.processMessage(message));

    await Promise.allSettled(processingPromises);
    this.logger.info(`Completed processing batch of ${messages.length} messages`);
    return { processed: messages.length, batchSize };
  }

  /**
   * Processes a single message through the middleware pipeline
   */
  private async processMessage(message: IOutboxMessage): Promise<void> {
    const [error] = await safeRun(async () => {
      // Mark as processing
      await this.repository.updateStatus(message.id, MessageStatus.PROCESSING);

      // Build middleware pipeline
      const pipeline = this.buildPipeline(message);
      await pipeline(message);

      // Mark as processed
      await this.repository.updateStatus(message.id, MessageStatus.PROCESSED);
      this.logger.debug(`Successfully processed message ${message.id}`);
    });

    if (error) {
      await this.handleMessageError(message, error);
    }
  }

  /**
   * Builds the middleware pipeline for message processing
   */
  private buildPipeline(message: IOutboxMessage): (msg: IOutboxMessage) => Promise<void> {
    const handler = this.handlers.get(message.messageType);
    if (!handler) {
      throw new Error(`No handler registered for message type: ${message.messageType}`);
    }

    // Create the final handler function
    const finalHandler = async (msg: IOutboxMessage): Promise<void> => {
      await Promise.race([
        handler.handle(msg),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Message processing timeout')),
            this.options.messageTimeout
          )
        ),
      ]);
    };

    // Build the middleware chain from right to left
    return this.middlewares.reduceRight((next, middleware) => middleware(next), finalHandler);
  }

  /**
   * Handles errors during message processing
   */
  private async handleMessageError(message: IOutboxMessage, error: Error): Promise<void> {
    try {
      const attempts = await this.repository.incrementAttempt(message.id);
      this.logger.warn(`Message ${message.id} failed, attempt ${attempts}: ${error?.message}`);

      if (attempts >= this.options.maxRetries) {
        await this.repository.updateStatus(message.id, MessageStatus.FAILED, error);
        this.logger.error(`Message ${message.id} marked as failed after ${attempts} attempts`);
      } else if (this.options.retryBackoff) {
        const { initial, multiplier, maxDelay } = this.options.retryBackoff;
        const delay = Math.min(initial * Math.pow(multiplier, attempts - 1), maxDelay);
        const processAfter = new Date(Date.now() + delay);
        // Reset to PENDING first so the message is never stuck in PROCESSING
        // if the repository's scheduleRetry is the inherited no-op.
        await this.repository.updateStatus(message.id, MessageStatus.PENDING);
        await this.repository.scheduleRetry(message.id, processAfter);
        this.logger.info(
          `Message ${message.id} scheduled for retry in ${delay}ms (attempt ${attempts})`
        );
      } else {
        // No backoff configured: immediate retry (legacy behavior)
        await this.repository.updateStatus(message.id, MessageStatus.PENDING);
        this.logger.info(`Message ${message.id} scheduled for retry (attempt ${attempts + 1})`);
      }
    } catch (updateError) {
      const errorMessage = updateError instanceof Error ? updateError.message : String(updateError);
      this.logger.error(`Error updating message status: ${errorMessage}`);
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
    const olderThan = new Date(Date.now() - this.options.crashRecoveryThresholdMs);
    const [error, count] = await safeRun(() => this.repository.resetStaleProcessing(olderThan));

    if (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Crash recovery failed: ${errorMessage}`);
      return;
    }

    if (count && count > 0) {
      this.logger.warn(`Crash recovery reset ${count} stale PROCESSING message(s) to PENDING`);
    }
  }

  /**
   * Logs messages if logging is enabled
   */
  private log(message: string): void {
    if (this.options.enableLogging) {
      this.logger.info(message);
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
  }> {
    return {
      isRunning: this.isRunning,
      batchSize: this.options.batchSize,
      maxRetries: this.options.maxRetries,
      processingInterval: this.options.processingInterval,
      registeredHandlers: Array.from(this.handlers.keys()),
      middlewareCount: this.middlewares.length,
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
