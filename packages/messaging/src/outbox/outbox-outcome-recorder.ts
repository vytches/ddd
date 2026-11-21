import { LibUtils } from '@vytches/ddd-utils';
import { internalLogger } from '@vytches/ddd-contracts/internal';
import { MessageStatus } from './outbox-interfaces';
import type { IOutboxMessage } from './outbox-interfaces';
import type { OutboxProcessorHooks, OutboxStaleWriteOperation } from './outbox-hooks';
import type { OutboxFencedReleaseOutcome } from './outbox-repository.interface';

/** One claimed message as the recorder sees it. `claimToken` is set only under fencing. */
export interface OutcomeClaim {
  /** The message handed to handlers and hooks (never carries the claim token). */
  readonly message: IOutboxMessage;
  readonly claimToken?: string;
}

/**
 * The storage primitives of one outcome-writing strategy (legacy or fenced).
 * The POLICY (attempt budget, hooks, backoff, completion-failure handling) lives
 * in {@link OutcomeRecorder} so both strategies can never drift apart.
 */
export interface OutcomeStore {
  /** Counts a failed attempt. `null` = the claim is no longer held (stale). */
  recordFailure(claim: OutcomeClaim, error: Error): Promise<number | null>;
  /** Sets PENDING (with optional `processAfter`) or FAILED. `false` = stale. */
  release(claim: OutcomeClaim, outcome: OutboxFencedReleaseOutcome): Promise<boolean>;
  /** Marks the message PROCESSED. `false` = stale. Rejects when the write fails. */
  complete(claim: OutcomeClaim): Promise<boolean>;
  /** After a failed `complete`: did the write actually commit? Never rejects. */
  alreadyProcessed(claim: OutcomeClaim): Promise<boolean>;
}

export interface OutcomeRecorderDeps {
  readonly store: OutcomeStore;
  /**
   * `false` (default for existing consumers): a failing completion write is
   * handled exactly as it always was — as a handler failure (attempt counted,
   * `onMessageFailed`, retry/FAILED). `true`: the opt-in policy described on
   * {@link OutcomeRecorder} (isolation, bounded redelivery, one release retry).
   */
  readonly isolateCompletionWriteFailures: boolean;
  readonly maxRetries: number;
  /** When a retry after `attempts` failures may be claimed; `undefined` = immediately. */
  retryAt(attempts: number): Date | undefined;
  /** Isolated hook invocation (a throwing hook must never break processing). */
  emit(hook: string, call: (hooks: OutboxProcessorHooks) => void): void;
}

/** Bound for the in-memory per-message completion-failure counters. */
const MAX_TRACKED_COMPLETION_FAILURES = 10_000;

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));

/**
 * Records handler outcomes. Shared policy:
 *
 * - **Handler failure** (throw or timeout): count an attempt, fire
 *   `onMessageFailed`, then release to FAILED (budget exhausted) or PENDING
 *   (with backoff).
 * - **Handler success, but the status write fails** — with
 *   `isolateCompletionWriteFailures` (implied by fencing; opt-in): NOT a handler
 *   failure — no attempt is consumed and `onMessageFailed` does not fire. The recorder checks
 *   whether the write actually committed, otherwise releases the message for
 *   re-delivery with the retry backoff, at most `maxRetries` times per process
 *   (then it gives up and leaves the message PROCESSING for crash recovery).
 *   `onCompletionWriteFailed` reports every such failure.
 * - **Stale write** (fenced strategy only): reported through `onStaleWrite`,
 *   nothing else happens.
 */
export class OutcomeRecorder {
  /** messageId -> consecutive completion-write failures seen by this process. */
  private readonly completionFailures = new Map<string, number>();

  constructor(private readonly deps: OutcomeRecorderDeps) {}

  /**
   * @returns `false` only when the completion write failed and did not turn out
   *   to have committed (the handler's success is kept either way).
   */
  async succeeded(claim: OutcomeClaim): Promise<boolean> {
    try {
      const applied = await this.deps.store.complete(claim);
      this.completionFailures.delete(claim.message.id);
      if (!applied) {
        this.stale(claim.message, 'complete');
      }
      return true;
    } catch (writeError) {
      if (!this.deps.isolateCompletionWriteFailures) {
        // Pre-existing behaviour, kept bit-for-bit for consumers that did not opt in.
        await this.failed(claim, toError(writeError));
        return false;
      }
      return this.completionWriteFailed(claim, toError(writeError));
    }
  }

  async failed(claim: OutcomeClaim, error: Error): Promise<void> {
    const { message } = claim;
    try {
      const attempts = await this.deps.store.recordFailure(claim, error);
      if (attempts === null) {
        this.stale(message, 'recordFailure');
        return;
      }
      internalLogger.warn(
        `OutboxProcessor: message ${LibUtils.sanitizeLogMessage(message.id)} failed, attempt ${attempts}: ${LibUtils.sanitizeLogMessage(error?.message ?? String(error))}`
      );
      this.deps.emit('onMessageFailed', hooks => hooks.onMessageFailed?.(message, error, attempts));

      const exhausted = attempts >= this.deps.maxRetries;
      const processAfter = exhausted ? undefined : this.deps.retryAt(attempts);
      const outcome: OutboxFencedReleaseOutcome = {
        status: exhausted ? MessageStatus.FAILED : MessageStatus.PENDING,
        error,
        ...(processAfter ? { processAfter } : {}),
      };
      const applied = this.deps.isolateCompletionWriteFailures
        ? await this.releaseWithOneRetry(claim, outcome)
        : await this.deps.store.release(claim, outcome);

      if (!applied) {
        this.stale(message, 'release');
        return;
      }
      if (exhausted) {
        internalLogger.error('OutboxProcessor: message permanently failed', error, {
          messageId: message.id,
          attempts,
        });
        this.deps.emit('onPermanentFailure', hooks => hooks.onPermanentFailure?.(message, error));
      }
    } catch (writeError) {
      internalLogger.error(
        'OutboxProcessor: error updating message status',
        writeError instanceof Error ? writeError : undefined,
        { messageId: message.id }
      );
    }
  }

  /** @returns `true` when the write had actually committed before the error surfaced. */
  private async completionWriteFailed(claim: OutcomeClaim, error: Error): Promise<boolean> {
    const { message } = claim;
    const consecutiveFailures = this.bumpCompletionFailures(message.id);
    internalLogger.error(
      'OutboxProcessor: handler succeeded but the completion write failed',
      error,
      { messageId: message.id, consecutiveFailures }
    );

    // The write may have committed before the error surfaced (timeout, lost ack).
    if (await this.deps.store.alreadyProcessed(claim)) {
      this.completionFailures.delete(message.id);
      return true;
    }

    let released = false;
    if (consecutiveFailures > this.deps.maxRetries) {
      internalLogger.error(
        'OutboxProcessor: completion write keeps failing — not releasing for re-delivery again; the message stays PROCESSING until crash recovery',
        undefined,
        { messageId: message.id, consecutiveFailures }
      );
    } else {
      released = await this.releaseForRedelivery(claim, consecutiveFailures);
    }
    this.deps.emit('onCompletionWriteFailed', hooks =>
      hooks.onCompletionWriteFailed?.(message, error, { consecutiveFailures, released })
    );
    return false;
  }

  private async releaseForRedelivery(claim: OutcomeClaim, failures: number): Promise<boolean> {
    const processAfter = this.deps.retryAt(failures);
    try {
      const applied = await this.deps.store.release(claim, {
        status: MessageStatus.PENDING,
        ...(processAfter ? { processAfter } : {}),
      });
      if (!applied) {
        this.stale(claim.message, 'release');
      }
      return applied;
    } catch (releaseError) {
      internalLogger.error(
        'OutboxProcessor: release after a failed completion write also failed — left for crash recovery',
        releaseError instanceof Error ? releaseError : undefined,
        { messageId: claim.message.id }
      );
      return false;
    }
  }

  /** A transient failure of the closing write must not strand the row in PROCESSING. */
  private async releaseWithOneRetry(
    claim: OutcomeClaim,
    outcome: OutboxFencedReleaseOutcome
  ): Promise<boolean> {
    try {
      return await this.deps.store.release(claim, outcome);
    } catch {
      return this.deps.store.release(claim, outcome);
    }
  }

  private bumpCompletionFailures(messageId: string): number {
    const next = (this.completionFailures.get(messageId) ?? 0) + 1;
    this.completionFailures.delete(messageId); // refresh insertion order
    this.completionFailures.set(messageId, next);
    if (this.completionFailures.size > MAX_TRACKED_COMPLETION_FAILURES) {
      const oldest = this.completionFailures.keys().next().value;
      if (oldest !== undefined) {
        this.completionFailures.delete(oldest);
      }
    }
    return next;
  }

  private stale(message: IOutboxMessage, operation: OutboxStaleWriteOperation): void {
    internalLogger.warn(
      `OutboxProcessor: stale ${operation} write ignored — the claim is no longer held`,
      { messageId: message.id }
    );
    this.deps.emit('onStaleWrite', hooks => hooks.onStaleWrite?.(message, operation));
  }
}
