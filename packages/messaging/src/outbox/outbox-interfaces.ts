/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Processing status of outbox messages
 * Used to track message processing state
 */
export enum MessageStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

/**
 * Priority levels for outbox messages
 * Used to order message processing
 */
export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Base interface for outbox messages
 * Represents a message that can be stored in the outbox
 */
export interface IOutboxMessage<T = any> {
  /** Unique identifier for the message */
  id: string;

  /** Type of message */
  messageType: string;

  /** Message payload */
  payload: T;

  /** Additional metadata */
  metadata: Record<string, any>;

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

/**
 * Options for outbox message creation
 */
export interface OutboxMessageOptions {
  /** When to process the message (for delayed processing) */
  processAfter?: Date;

  /** Priority level */
  priority?: MessagePriority;

  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Interface for outbox message handlers
 */
export interface IOutboxMessageHandler<T = any> {
  /**
   * Handles a message from the outbox
   * @param message Message to handle
   */
  handle(message: IOutboxMessage<T>): Promise<void>;
}

/**
 * Middleware function type for outbox message processing
 * Enables creation of processing pipelines for outbox messages
 */
export type OutboxMiddleware = (
  next: (message: IOutboxMessage) => Promise<void>,
) => (message: IOutboxMessage) => Promise<void>;
