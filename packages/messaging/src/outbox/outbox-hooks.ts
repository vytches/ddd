import type { IOutboxMessage } from './outbox-interfaces';

/**
 * Observability callbacks for {@link OutboxProcessor}. Use them to wire metrics
 * (Prometheus counters, DataDog), alerting on permanent failures, or dead-letter
 * routing — without coupling the processor to any specific telemetry stack.
 *
 * **Hooks must be synchronous and fast.** Each call is wrapped in a try/catch by
 * the processor, so a throwing hook is logged and ignored (it never breaks the
 * processing loop), but a slow hook still blocks the batch. Offload heavy work
 * (network, disk) to a queue inside the hook.
 */
export interface OutboxProcessorHooks {
  /** Fired once per processed batch with aggregate counts and wall-clock duration. */
  onBatchComplete?(result: {
    processed: number;
    failed: number;
    batchSize: number;
    durationMs: number;
  }): void;
  /**
   * Fired on every HANDLER failure (a throw or a timeout), including ones that
   * will be retried. By default it also fires when the handler succeeded but the
   * `PROCESSED` write failed (unchanged behaviour); with
   * `isolateCompletionWriteFailures` / `useFencing` that case is reported through
   * `onCompletionWriteFailed` instead. Not fired when recording the failure was
   * skipped because the claim was lost (see `onStaleWrite`).
   */
  onMessageFailed?(message: IOutboxMessage, error: Error, attempt: number): void;
  /** Fired when a message is marked `FAILED` after exhausting `maxRetries`. */
  onPermanentFailure?(message: IOutboxMessage, error: Error): void;
  /**
   * Fired the moment a handler exceeds its timeout (after the context signal is
   * aborted, before the failure is recorded). The handler may still be running.
   * Normally followed by `onMessageFailed` for the same message — unless
   * recording the failure is skipped (stale claim under fencing) or fails.
   */
  onHandlerTimeout?(message: IOutboxMessage, info: OutboxHandlerTimeoutInfo): void;
  /**
   * Fired when a handler that previously timed out finally settles. `lateMs` is
   * the time elapsed since the timeout. Use it to measure how long timed-out
   * handlers keep running (overlap with retries). Never fired for handlers that
   * finish in time, and never fired if the handler never settles.
   */
  onLateSettle?(message: IOutboxMessage, outcome: OutboxLateSettleOutcome, lateMs: number): void;
  /**
   * Only with `useFencing`: a status write was rejected because this attempt no
   * longer holds the claim (the message was reclaimed or reset). The result of
   * this attempt is discarded.
   *
   * - `'complete'` / `'recordFailure'`: nothing was changed in the repository.
   * - `'release'`: the failure had already been recorded (`attempts` incremented,
   *   `onMessageFailed` fired); only the status change and `onPermanentFailure`
   *   are discarded.
   */
  onStaleWrite?(message: IOutboxMessage, operation: OutboxStaleWriteOperation): void;
  /**
   * Only with `isolateCompletionWriteFailures` (or `useFencing`): the handler
   * succeeded but the status write failed. This is NOT a handler
   * failure: no attempt is consumed and `onMessageFailed` does not fire. The
   * message is re-delivered (with the retry backoff) up to `maxRetries` times per
   * process, so its side effects may repeat — alert on this hook.
   */
  onCompletionWriteFailed?(
    message: IOutboxMessage,
    error: Error,
    info: OutboxCompletionWriteFailure
  ): void;
}

/**
 * Reported by `onCompletionWriteFailed`: the handler SUCCEEDED but writing the
 * `PROCESSED` status failed.
 */
export interface OutboxCompletionWriteFailure {
  /** Consecutive completion-write failures of this message seen by this process (1-based). */
  consecutiveFailures: number;
  /**
   * `true`: the message was released to `PENDING` and will be delivered again.
   * `false`: it was left `PROCESSING` (redelivery budget exhausted, the release
   * also failed, or the claim was lost) — only crash recovery can bring it back,
   * and only if `crashRecoveryIntervalMs` is configured.
   */
  released: boolean;
}

export type OutboxStaleWriteOperation = 'complete' | 'recordFailure' | 'release';

export interface OutboxHandlerTimeoutInfo {
  /** The effective timeout that elapsed (per-handler override or processor default). */
  timeoutMs: number;
  /** 1-based attempt number of the invocation that timed out. */
  attempt: number;
}

export type OutboxLateSettleOutcome = 'resolved' | 'rejected';
