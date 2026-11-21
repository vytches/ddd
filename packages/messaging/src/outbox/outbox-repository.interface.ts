/* eslint-disable @typescript-eslint/no-explicit-any */
import { MessageStatus } from './outbox-interfaces';
import type { IOutboxMessage, MessagePriority } from './outbox-interfaces';

/**
 * Optional hints passed by `OutboxProcessor` to
 * {@link IOutboxRepository.resetStaleProcessing}.
 */
export interface ResetStaleProcessingOptions {
  /**
   * The processor's `messageTypes` allow-list. When present, implementations
   * SHOULD reset only `PROCESSING` messages of these types — several processors
   * sharing one table partition it by type, and each has its own timeouts.
   * Absent means "all types" (the pre-existing behaviour).
   */
  readonly messageTypes?: readonly string[];
  /** The processor's `maxRetries`, for implementations that budget recoveries. */
  readonly maxRetries?: number;
}

/** Terminal/next state written by {@link IOutboxRepository.releaseFenced}. */
export interface OutboxFencedReleaseOutcome {
  /** `PENDING` to retry, `FAILED` once the retry budget is exhausted. */
  readonly status: MessageStatus.PENDING | MessageStatus.FAILED;
  /** Earliest time the message may be claimed again (retry backoff). */
  readonly processAfter?: Date;
  /** Failure to store as the message's last error. */
  readonly error?: Error;
}

export abstract class IOutboxRepository {
  /**
   * Saves a message to the outbox
   * @param message Message to save
   * @returns ID of the saved message
   */
  abstract saveMessage<T = unknown>(message: IOutboxMessage<T>): Promise<string>;

  /**
   * Saves multiple messages to the outbox
   * @param messages Messages to save
   * @returns IDs of the saved messages
   */
  abstract saveBatch<T = unknown>(messages: IOutboxMessage<T>[]): Promise<string[]>;

  /**
   * Returns unprocessed messages up to the given limit.
   *
   * **Not a claim.** This is a pure read — it does not mark returned messages
   * as `PROCESSING` or otherwise reserve them. `OutboxProcessor` calls
   * `updateStatus(id, PROCESSING)` for each message *after* this read
   * returns, which means there is a window between "read" and "claimed"
   * during which two concurrent processors (or two calls racing on the same
   * processor) can both read the same PENDING message and both dispatch it.
   * Multi-worker deployments that need "exactly one processor claims each
   * message" should implement {@link claimBatch} with an atomic
   * read+mark (e.g. `SELECT ... FOR UPDATE SKIP LOCKED` or a single
   * `UPDATE ... WHERE status='PENDING' RETURNING *` statement / compare-
   * and-swap on `status`) rather than relying on this method plus a
   * follow-up `updateStatus`.
   *
   * Regardless of claim strategy, handlers should be idempotent to side
   * effects — transient failures or duplicate-claim races may cause a
   * handler to run more than once.
   *
   * @param limit - Maximum number of messages to return.
   * @param priorityOrder - Ordered array of MessagePriority values defining
   *   processing order (first element = highest priority, processed first).
   *   Implementations MUST sort results by the position of each message's
   *   priority in this array — do NOT use ORDER BY priority directly on the
   *   string column. Alphabetical sort inverts the intent: 'critical' sorts
   *   after 'high' alphabetically, causing CRITICAL messages to be processed
   *   last. Use comparePriority() or array index-based sorting instead.
   * @param messageTypes - Optional allow-list of message types to return.
   *   When provided, only messages whose messageType is in this array are
   *   returned. When absent, all message types are returned.
   */
  abstract getUnprocessedMessages(
    limit?: number,
    priorityOrder?: MessagePriority[],
    messageTypes?: string[]
  ): Promise<IOutboxMessage[]>;

  /**
   * Atomically claims a batch of unprocessed messages: reads PENDING
   * messages *and* marks them `PROCESSING` in the same operation, so two
   * concurrent callers (two processor instances, or two racing calls on one
   * instance) never both receive the same message.
   *
   * **Optional, and non-atomic by default.** This method is declared with
   * `?` — it is NOT part of the required abstract contract, so existing
   * `IOutboxRepository` subclasses keep compiling unmodified (AC#5). The
   * default implementation provided here is a convenience shim only: it
   * calls {@link getUnprocessedMessages} and then `updateStatusBatch(...,
   * PROCESSING)` as two separate steps. **That is NOT atomic** — it has the
   * exact same read-then-mark race window as calling
   * `getUnprocessedMessages` + `updateStatus` manually, and is safe only for
   * a single-worker deployment. Override `claimBatch` in a concrete
   * repository (e.g. backed by `SELECT ... FOR UPDATE SKIP LOCKED`, or a
   * single atomic `UPDATE ... WHERE status='PENDING' LIMIT n RETURNING *`)
   * to get real multi-worker/multi-processor safety.
   *
   * `OutboxProcessor` only calls this method when
   * `OutboxProcessorOptions.useClaimBatch` (or `useFencing`, which implies it)
   * is explicitly set to `true` (opt-in, default `false`) — see AC#1/AC#2.
   * With `useFencing` the repository MUST override this method and set a
   * unique `claimToken` on every returned message (the constructor rejects the
   * inherited default). When enabled, the processor
   * skips its own redundant `updateStatus(id, PROCESSING)` call for messages
   * returned by `claimBatch`, since claiming already performed that mark.
   *
   * Handlers should be idempotent to side effects regardless — transient
   * failures or duplicate-claim races (e.g. with the non-atomic default
   * implementation) may still cause a handler to run more than once.
   *
   * @param limit - Maximum number of messages to claim.
   * @param priorityOrder - See {@link getUnprocessedMessages}.
   * @param messageTypes - See {@link getUnprocessedMessages}.
   * @returns Messages that were claimed (already marked `PROCESSING`).
   */
  async claimBatch?(
    limit?: number,
    priorityOrder?: MessagePriority[],
    messageTypes?: string[]
  ): Promise<IOutboxMessage[]> {
    const messages = await this.getUnprocessedMessages(limit, priorityOrder, messageTypes);
    if (messages.length === 0) {
      return messages;
    }
    await this.updateStatusBatch(
      messages.map(m => m.id),
      MessageStatus.PROCESSING
    );
    return messages.map(m => ({ ...m, status: MessageStatus.PROCESSING }));
  }

  /**
   * Gets specific message by ID
   * @param id Message ID
   * @returns Message or null if not found
   */
  abstract getById(id: string): Promise<IOutboxMessage | null>;

  /**
   * Updates message status
   * @param id Message ID
   * @param status New status
   * @param error Optional error information
   */
  abstract updateStatus(id: string, status: MessageStatus, error?: Error): Promise<void>;

  /**
   * Updates message status for multiple messages
   * @param ids Message IDs
   * @param status New status
   */
  abstract updateStatusBatch(ids: string[], status: MessageStatus): Promise<void>;

  /**
   * Increments attempt counter for a message
   * @param id Message ID
   * @returns Updated attempt count
   */
  abstract incrementAttempt(id: string): Promise<number>;

  /**
   * Deletes messages with specified status older than a specified date
   * @param olderThan Date threshold
   * @param status Status of messages to delete
   * @returns Number of deleted messages
   */
  abstract deleteByStatusAndAge(olderThan: Date, status: MessageStatus): Promise<number>;

  /**
   * Schedules a message for delayed processing
   * @param message Message to schedule
   * @param processAfter When to process the message
   * @returns ID of the saved message
   */
  abstract scheduleMessage<T = unknown>(
    message: IOutboxMessage<T>,
    processAfter: Date
  ): Promise<string>;

  /**
   * Schedules a retry for a failed message at a specific future time.
   *
   * Default implementation is a no-op — repositories that do not support
   * delayed processing will fall back to immediate retry (PENDING reset).
   * Override this in concrete repositories to enable exponential backoff.
   *
   * **Multi-worker note:** `OutboxProcessor` calls `updateStatus(PENDING)` immediately
   * before this method. In multi-worker environments, override this to perform
   * an atomic `UPDATE ... SET status=PENDING, process_after=?` in a single statement,
   * and ensure `getUnprocessedMessages` filters `WHERE process_after IS NULL OR process_after <= NOW()`
   * to prevent duplicate dispatch during the window between the two calls.
   *
   * @param id Message ID
   * @param processAfter When to retry the message
   */
  scheduleRetry(_id: string, _processAfter: Date): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Resets messages stuck in `PROCESSING` back to `PENDING` so they can be
   * re-dispatched. Used for crash recovery: if a worker dies mid-batch, its
   * in-flight messages remain `PROCESSING` forever without this.
   *
   * Default implementation is a no-op returning `0` — repositories that do not
   * track a per-message "processing since" timestamp simply opt out. Override
   * in concrete repositories, e.g.:
   * `UPDATE outbox_messages SET status='PENDING' WHERE status='PROCESSING' AND updated_at < olderThan`.
   *
   * **Safety:** implementations MUST only reset messages whose processing
   * started strictly before `olderThan`. `OutboxProcessor` always passes a past
   * timestamp (`now - crashRecoveryThresholdMs`, with the threshold validated to
   * be `>= messageTimeout`, including per-handler timeouts), so legitimately
   * in-flight messages are never reset.
   *
   * **Recovery does not consume the retry budget.** The processor increments
   * `attempts` only when a handler throws or times out. A reset performed here
   * leaves `attempts` untouched (it neither increments nor zeroes it) unless
   * your implementation does so. Consequence: a message that kills its worker
   * every time (OOM, SIGKILL) is recovered forever and never reaches `FAILED`.
   * To bound it, increment `attempts` in your `resetStaleProcessing` and move
   * messages with `attempts >= options.maxRetries` to `FAILED`; the processor
   * does not do this for you, and `onPermanentFailure` is not fired for them.
   *
   * @param olderThan Reset only `PROCESSING` messages last touched before this instant
   * @param options Optional hints (`messageTypes`, `maxRetries`). Implementations
   *   declared with a single parameter keep working — the argument is ignored.
   * @returns Number of messages reset to `PENDING`
   */
  resetStaleProcessing(_olderThan: Date, _options?: ResetStaleProcessingOptions): Promise<number> {
    return Promise.resolve(0);
  }

  /**
   * **Fencing (opt-in, `OutboxProcessorOptions.useFencing`).** No default
   * implementation: there is no safe shim, so a repository that does not
   * implement the three `*Fenced` methods cannot be used with `useFencing`
   * (the processor constructor throws).
   *
   * A fencing-aware `claimBatch` must set a fresh, unique `claimToken` on every
   * message it claims (and persist it). Each `*Fenced` write below MUST apply
   * only while the claim is still held, atomically in ONE statement, e.g.
   * `... WHERE id = $1 AND status = 'PROCESSING' AND claim_token = $2`, and
   * report whether a row changed. Checking `status` alone is not enough: a
   * re-claim sets `PROCESSING` again (ABA) — the token is what identifies the
   * claim. `resetStaleProcessing` MUST clear the token when it resets a row.
   *
   * `satisfies FencedOutboxRepository` verifies the three methods at compile time.
   *
   * Marks the message `PROCESSED` and clears the token.
   * @returns `true` if applied, `false` if the claim is no longer held (stale).
   *   May reject when the write itself fails; that is reported through the
   *   `onCompletionWriteFailed` hook and is NOT a handler failure (fencing
   *   implies `isolateCompletionWriteFailures`).
   */
  completeFenced?(id: string, claimToken: string): Promise<boolean>;

  /**
   * Atomically `attempts = attempts + 1` and stores `error` as the last error,
   * only while the claim is held. The status stays `PROCESSING`; the processor
   * follows up with {@link releaseFenced}.
   * @returns The new attempts count, or `null` if the claim is no longer held.
   */
  recordFailureFenced?(id: string, claimToken: string, error: Error): Promise<number | null>;

  /**
   * In ONE statement: sets `outcome.status`, `process_after` (an absent
   * `outcome.processAfter` clears it) and the last error, and clears the token — only while the claim is held. This
   * replaces the legacy `updateStatus(PENDING)` + `scheduleRetry` pair, closing
   * the window in which a retried message is claimable before its delay is set.
   * @returns `true` if applied, `false` if the claim is no longer held (stale).
   */
  releaseFenced?(
    id: string,
    claimToken: string,
    outcome: OutboxFencedReleaseOutcome
  ): Promise<boolean>;
}

/** An {@link IOutboxRepository} that implements all three fenced writes. */
export type FencedOutboxRepository = IOutboxRepository &
  Required<Pick<IOutboxRepository, 'completeFenced' | 'recordFailureFenced' | 'releaseFenced'>>;
