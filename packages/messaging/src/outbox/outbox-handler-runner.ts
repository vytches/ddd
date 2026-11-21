import { OutboxTimeoutError } from './outbox-timeout-error';
import type {
  IOutboxMessage,
  IOutboxMessageHandler,
  OutboxHandlerContext,
} from './outbox-interfaces';

export interface HandlerRunCallbacks {
  /** Invoked synchronously when the timeout fires, after the signal is aborted. */
  onTimeout?(info: { timeoutMs: number; attempt: number }): void;
  /** Invoked when a handler that already timed out finally settles. */
  onLateSettle?(outcome: 'resolved' | 'rejected', lateMs: number): void;
}

/**
 * Runs `handler.handle(message, context)` racing it against `timeoutMs`.
 *
 * On timeout the context signal is aborted with an {@link OutboxTimeoutError}
 * and the returned promise rejects with the same error. The handler is never
 * killed — if it ignores the signal it keeps running, and its eventual outcome
 * is only reported through `onLateSettle`.
 */
export async function runHandlerWithTimeout(
  handler: IOutboxMessageHandler,
  message: IOutboxMessage,
  timeoutMs: number,
  callbacks: HandlerRunCallbacks = {}
): Promise<void> {
  const controller = new AbortController();
  const startedAt = Date.now();
  const attempt = message.attempts + 1;
  const context: OutboxHandlerContext = Object.freeze({
    signal: controller.signal,
    attempt,
    deadline: new Date(startedAt + timeoutMs),
    messageId: message.id,
  });

  // A synchronous throw from handle() propagates before any timer exists.
  const handlerPromise = Promise.resolve(handler.handle(message, context));

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let timedOutAt: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOutAt = Date.now();
      const error = new OutboxTimeoutError({
        messageId: message.id,
        messageType: message.messageType,
        timeoutMs,
        attempt,
      });
      controller.abort(error);
      callbacks.onTimeout?.({ timeoutMs, attempt });
      reject(error);
    }, timeoutMs);
  });

  try {
    await Promise.race([handlerPromise, timeoutPromise]);
  } finally {
    // Clear regardless of which branch won — otherwise a fast handler leaves
    // the timer pending for the full timeout (one leaked timer per message).
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    if (timedOutAt !== undefined) {
      const firedAt = timedOutAt;
      handlerPromise.then(
        () => callbacks.onLateSettle?.('resolved', Date.now() - firedAt),
        () => callbacks.onLateSettle?.('rejected', Date.now() - firedAt)
      );
    }
  }
}
