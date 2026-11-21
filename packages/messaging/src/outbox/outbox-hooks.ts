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
  /** Fired on every message failure, including ones that will be retried. */
  onMessageFailed?(message: IOutboxMessage, error: Error, attempt: number): void;
  /** Fired when a message is marked `FAILED` after exhausting `maxRetries`. */
  onPermanentFailure?(message: IOutboxMessage, error: Error): void;
  /**
   * Fired the moment a handler exceeds its timeout (after the context signal is
   * aborted, before the failure is recorded). The handler may still be running.
   * Always followed by `onMessageFailed` for the same message.
   */
  onHandlerTimeout?(message: IOutboxMessage, info: OutboxHandlerTimeoutInfo): void;
  /**
   * Fired when a handler that previously timed out finally settles. `lateMs` is
   * the time elapsed since the timeout. Use it to measure how long timed-out
   * handlers keep running (overlap with retries). Never fired for handlers that
   * finish in time, and never fired if the handler never settles.
   */
  onLateSettle?(message: IOutboxMessage, outcome: OutboxLateSettleOutcome, lateMs: number): void;
}

export interface OutboxHandlerTimeoutInfo {
  /** The effective timeout that elapsed (per-handler override or processor default). */
  timeoutMs: number;
  /** 1-based attempt number of the invocation that timed out. */
  attempt: number;
}

export type OutboxLateSettleOutcome = 'resolved' | 'rejected';
