import { OutboxTimeoutError } from './outbox-timeout-error';
import type {
  IOutboxMessage,
  IOutboxMessageHandler,
  OutboxHandlerContext,
} from './outbox-interfaces';

/**
 * Callbacks MUST NOT throw: `onTimeout` runs inside a timer callback and
 * `onLateSettle` inside a detached promise reaction, so an exception there
 * would be uncaught. `OutboxProcessor` wraps both in its hook isolation.
 */
export interface HandlerRunCallbacks {
  /** Invoked synchronously when the timeout fires, after the race was settled and the signal aborted. */
  onTimeout?(info: { timeoutMs: number; attempt: number }): void;
  /** Invoked when a handler that already timed out finally settles. */
  onLateSettle?(outcome: 'resolved' | 'rejected', lateMs: number): void;
}

/**
 * Runs `handler.handle(message, context)` racing it against `timeoutMs`.
 *
 * On timeout the returned promise rejects with an {@link OutboxTimeoutError} —
 * always, even when the handler settles successfully inside an `abort` listener —
 * and the context signal is aborted with the same error. The handler is never
 * killed: if it ignores the signal it keeps running, and its eventual outcome is
 * only reported through `onLateSettle`.
 *
 * Note: `abort` listeners run synchronously. An exception thrown by a consumer's
 * listener is reported by the runtime as an uncaught exception (it does not
 * propagate to this function), so listeners must not throw.
 */
export async function runHandlerWithTimeout(
  handler: IOutboxMessageHandler,
  message: IOutboxMessage,
  timeoutMs: number,
  callbacks: HandlerRunCallbacks = {}
): Promise<void> {
  const controller = new AbortController();
  const startedAt = Date.now();
  // Hand-rolled repositories may return a non-numeric attempts value.
  const attempt = (Number.isFinite(message.attempts) ? message.attempts : 0) + 1;
  const context: OutboxHandlerContext = Object.freeze({
    signal: controller.signal,
    attempt,
    deadline: new Date(startedAt + timeoutMs),
    messageId: message.id,
  });

  // A synchronous throw from handle() propagates before any timer exists.
  const handlerPromise = Promise.resolve(handler.handle(message, context));

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timeoutError: OutboxTimeoutError | undefined;
  let timedOutAt: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOutAt = performance.now();
      timeoutError = new OutboxTimeoutError({
        messageId: message.id,
        messageType: message.messageType,
        timeoutMs,
        attempt,
      });
      // Settle the race from the timeout side FIRST: abort listeners run
      // synchronously and a handler resolving inside one must not win the race.
      reject(timeoutError);
      controller.abort(timeoutError);
      callbacks.onTimeout?.({ timeoutMs, attempt });
    }, timeoutMs);
  });

  try {
    await Promise.race([handlerPromise, timeoutPromise]);
    // Belt and braces: a timeout is a timeout regardless of who settled first.
    if (timeoutError) {
      throw timeoutError;
    }
  } finally {
    // Clear regardless of which branch won — otherwise a fast handler leaves
    // the timer pending for the full timeout (one leaked timer per message).
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (timedOutAt !== undefined) {
      const firedAt = timedOutAt;
      handlerPromise
        .then(
          () => callbacks.onLateSettle?.('resolved', performance.now() - firedAt),
          () => callbacks.onLateSettle?.('rejected', performance.now() - firedAt)
        )
        // The callbacks are required not to throw; this only guarantees that a
        // misbehaving one can never become an unhandled rejection (fatal in Node).
        .catch(() => undefined);
    }
  }
}
