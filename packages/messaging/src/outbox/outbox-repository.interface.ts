/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IOutboxMessage, MessageStatus, MessagePriority } from './outbox-interfaces';

/**
 * Abstract class for outbox repository
 * Defines operations on the outbox independent of concrete implementation
 */
export abstract class IOutboxRepository {
  /**
   * Saves a message to the outbox
   * @param message Message to save
   * @returns ID of the saved message
   */
  abstract saveMessage<T = unknown>(message: IOutboxMessage<T>): Promise<string>;

  /**
   * Saves multiple messages to the outbox
   * @param messages Messages to save
   * @returns IDs of the saved messages
   */
  abstract saveBatch<T = unknown>(messages: IOutboxMessage<T>[]): Promise<string[]>;

  /**
   * Gets unprocessed messages from the outbox
   * @param limit Maximum number of messages to retrieve
   * @param priorityOrder Order of priority for processing (default: [CRITICAL, HIGH, NORMAL, LOW])
   * @returns Unprocessed messages
   */
  abstract getUnprocessedMessages(
    limit?: number,
    priorityOrder?: MessagePriority[]
  ): Promise<IOutboxMessage[]>;

  /**
   * Gets specific message by ID
   * @param id Message ID
   * @returns Message or null if not found
   */
  abstract getById(id: string): Promise<IOutboxMessage | null>;

  /**
   * Updates message status
   * @param id Message ID
   * @param status New status
   * @param error Optional error information
   */
  abstract updateStatus(id: string, status: MessageStatus, error?: Error): Promise<void>;

  /**
   * Updates message status for multiple messages
   * @param ids Message IDs
   * @param status New status
   */
  abstract updateStatusBatch(ids: string[], status: MessageStatus): Promise<void>;

  /**
   * Increments attempt counter for a message
   * @param id Message ID
   * @returns Updated attempt count
   */
  abstract incrementAttempt(id: string): Promise<number>;

  /**
   * Deletes messages with specified status older than a specified date
   * @param olderThan Date threshold
   * @param status Status of messages to delete
   * @returns Number of deleted messages
   */
  abstract deleteByStatusAndAge(olderThan: Date, status: MessageStatus): Promise<number>;

  /**
   * Schedules a message for delayed processing
   * @param message Message to schedule
   * @param processAfter When to process the message
   * @returns ID of the saved message
   */
  abstract scheduleMessage<T = unknown>(
    message: IOutboxMessage<T>,
    processAfter: Date
  ): Promise<string>;
}
