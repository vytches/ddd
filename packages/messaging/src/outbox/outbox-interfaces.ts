/**
 * @llm-summary Enumeration of message status values
 * @llm-domain Integration
 * @llm-usage Frequent
 *
 * @description
 * MessageStatus enum implementing integration layer component for message status operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: MessageStatus = MessageStatus.VALUE;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export enum MessageStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

/**
 * @llm-summary Enumeration of message priority values
 * @llm-domain Integration
 * @llm-usage Frequent
 *
 * @description
 * MessagePriority enum implementing integration layer component for message priority operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: MessagePriority = MessagePriority.VALUE;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * @llm-summary Contract for outbox message functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * OutboxMessage interface implementing integration layer component for outbox message operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteOutboxMessage implements IOutboxMessage {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
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

/**
 * @llm-summary Contract for outbox message options functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * OutboxMessageOptions interface implementing integration layer component for outbox message options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteOutboxMessageOptions implements OutboxMessageOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface OutboxMessageOptions {
  /** When to process the message (for delayed processing) */
  processAfter?: Date;

  /** Priority level */
  priority?: MessagePriority;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * @llm-summary Contract for outbox message handler functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * OutboxMessageHandler interface implementing integration layer component for outbox message handler operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteOutboxMessageHandler implements IOutboxMessageHandler {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IOutboxMessageHandler<T = unknown> {
  /**
   * Handles a message from the outbox
   * @param message Message to handle
   */
  handle(message: IOutboxMessage<T>): Promise<void>;
}

/**
 * @llm-summary Type definition for outbox middleware
 * @llm-domain Integration
 * @llm-usage Frequent
 *
 * @description
 * OutboxMiddleware type implementing integration layer component for outbox middleware operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: OutboxMiddleware = {} as OutboxMiddleware;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type OutboxMiddleware = (
  next: (message: IOutboxMessage) => Promise<void>
) => (message: IOutboxMessage) => Promise<void>;
