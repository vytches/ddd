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
