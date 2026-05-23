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
}
