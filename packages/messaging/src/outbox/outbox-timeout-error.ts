/** Message text kept identical to the pre-existing plain `Error` for string-matching consumers. */
const TIMEOUT_MESSAGE = 'Message processing timeout';

export interface OutboxTimeoutErrorDetails {
  readonly messageId: string;
  readonly messageType: string;
  readonly timeoutMs: number;
  readonly attempt: number;
}

/**
 * Raised (and used as `AbortSignal.reason`) when an outbox handler exceeds its
 * timeout. Replaces an untyped `Error('Message processing timeout')`; the
 * `message` text is unchanged, so existing string matching keeps working.
 */
export class OutboxTimeoutError extends Error {
  readonly messageId: string;
  readonly messageType: string;
  readonly timeoutMs: number;
  readonly attempt: number;

  constructor(details: OutboxTimeoutErrorDetails) {
    super(TIMEOUT_MESSAGE);
    this.name = 'OutboxTimeoutError';
    this.messageId = details.messageId;
    this.messageType = details.messageType;
    this.timeoutMs = details.timeoutMs;
    this.attempt = details.attempt;
  }
}
