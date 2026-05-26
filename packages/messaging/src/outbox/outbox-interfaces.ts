export enum MessageStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface IOutboxMessage<T = unknown> {
  /** Unique identifier for the message */
  id: string;

  /** Type of message */
  messageType: string;

  /** Message payload */
  payload: T;

  /** Additional metadata */
  metadata: Record<string, unknown>;

  /** Processing status */
  status: MessageStatus;

  /** Processing attempts count */
  attempts: number;

  /** When the message was created */
  createdAt: Date;

  /** When to process the message (for delayed processing) */
  processAfter?: Date;

  /** Priority level */
  priority?: MessagePriority;

  /** Last error message (if any) */
  lastError?: string;
}

export interface OutboxMessageOptions {
  /** When to process the message (for delayed processing) */
  processAfter?: Date;

  /** Priority level */
  priority?: MessagePriority;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface IOutboxMessageHandler<T = unknown> {
  /**
   * Handles a message from the outbox
   * @param message Message to handle
   */
  handle(message: IOutboxMessage<T>): Promise<void>;
}

export type OutboxMiddleware = (
  next: (message: IOutboxMessage) => Promise<void>
) => (message: IOutboxMessage) => Promise<void>;

const DEFAULT_PRIORITY_ORDER: MessagePriority[] = [
  MessagePriority.CRITICAL,
  MessagePriority.HIGH,
  MessagePriority.NORMAL,
  MessagePriority.LOW,
];

/**
 * Compares two MessagePriority values for sorting purposes.
 *
 * Returns a negative number if `a` should be processed before `b`,
 * positive if `b` before `a`, 0 if equal.
 *
 * @param order - Processing order array (first element = highest priority).
 *   Defaults to [CRITICAL, HIGH, NORMAL, LOW].
 *   Values absent from the array sort LAST (treated as lowest priority).
 *   Passing a partial array is safe — missing values are not promoted.
 *
 * @example
 * // Sort messages by priority (highest first):
 * messages.sort((a, b) => comparePriority(a.priority, b.priority));
 *
 * // Custom order:
 * messages.sort((a, b) => comparePriority(a.priority, b.priority, ['high', 'critical', 'normal', 'low']));
 */
export function comparePriority(
  a: MessagePriority,
  b: MessagePriority,
  order: MessagePriority[] = DEFAULT_PRIORITY_ORDER
): number {
  const rankA = order.includes(a) ? order.indexOf(a) : order.length;
  const rankB = order.includes(b) ? order.indexOf(b) : order.length;
  return rankA - rankB;
}
