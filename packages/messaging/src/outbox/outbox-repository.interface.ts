/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IOutboxMessage, MessagePriority, MessageStatus } from './outbox-interfaces';

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
   * @param messageTypes Optional allow-list of message types to fetch. When
   *   provided, only messages whose `messageType` is in this list are returned
   *   (e.g. `WHERE message_type IN (...)`). Omitting it fetches all types —
   *   this parameter is optional and backward-compatible.
   * @returns Unprocessed messages
   */
  abstract getUnprocessedMessages(
    limit?: number,
    priorityOrder?: MessagePriority[],
    messageTypes?: string[]
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

  /**
   * Schedules a retry for a failed message at a specific future time.
   *
   * Default implementation is a no-op — repositories that do not support
   * delayed processing will fall back to immediate retry (PENDING reset).
   * Override this in concrete repositories to enable exponential backoff.
   *
   * **Multi-worker note:** `OutboxProcessor` calls `updateStatus(PENDING)` immediately
   * before this method. In multi-worker environments, override this to perform
   * an atomic `UPDATE ... SET status=PENDING, process_after=?` in a single statement,
   * and ensure `getUnprocessedMessages` filters `WHERE process_after IS NULL OR process_after <= NOW()`
   * to prevent duplicate dispatch during the window between the two calls.
   *
   * @param id Message ID
   * @param processAfter When to retry the message
   */
  scheduleRetry(_id: string, _processAfter: Date): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Resets messages stuck in `PROCESSING` back to `PENDING` so they can be
   * re-dispatched. Used for crash recovery: if a worker dies mid-batch, its
   * in-flight messages remain `PROCESSING` forever without this.
   *
   * Default implementation is a no-op returning `0` — repositories that do not
   * track a per-message "processing since" timestamp simply opt out. Override
   * in concrete repositories, e.g.:
   * `UPDATE outbox_messages SET status='PENDING' WHERE status='PROCESSING' AND updated_at < olderThan`.
   *
   * **Safety:** implementations MUST only reset messages whose processing
   * started strictly before `olderThan`. `OutboxProcessor` always passes a past
   * timestamp (`now - crashRecoveryThresholdMs`, with the threshold validated to
   * be `>= messageTimeout`), so legitimately in-flight messages are never reset.
   *
   * @param olderThan Reset only `PROCESSING` messages last touched before this instant
   * @returns Number of messages reset to `PENDING`
   */
  resetStaleProcessing(_olderThan: Date): Promise<number> {
    return Promise.resolve(0);
  }
}
