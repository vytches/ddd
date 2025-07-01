/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IExtendedDomainEvent } from '@vytches-ddd/contracts';
import { Logger } from '@vytches-ddd/logging';

import type {
  IOutboxMessage,
  OutboxMessageOptions} from './outbox-interfaces';
import {
  MessagePriority,
  MessageStatus
} from './outbox-interfaces';
import { OutboxMessageFactory } from './outbox-message-factory';
import type { IOutboxRepository } from './outbox-repository.interface';

/**
 * Configuration options for OutboxService
 */
export interface OutboxServiceOptions {
  /** Default priority for messages */
  defaultPriority?: MessagePriority;
  /** Default metadata to add to all messages */
  defaultMetadata?: Record<string, any>;
  /** Enable automatic cleanup of processed messages */
  autoCleanup?: boolean;
  /** Age threshold for cleanup (in days) */
  cleanupAfterDays?: number;
  /** Enable logging */
  enableLogging?: boolean;
}

/**
 * High-level service for managing outbox operations
 * Provides convenient methods for saving, scheduling, and managing outbox messages
 */
export class OutboxService {
  private readonly repository: IOutboxRepository;
  private readonly options: Required<OutboxServiceOptions>;
  private readonly logger = Logger.create('OutboxService');

  constructor(
    repository: IOutboxRepository,
    options: OutboxServiceOptions = {},
  ) {
    this.repository = repository;
    this.options = {
      defaultPriority: options.defaultPriority ?? MessagePriority.NORMAL,
      defaultMetadata: options.defaultMetadata ?? {},
      autoCleanup: options.autoCleanup ?? false,
      cleanupAfterDays: options.cleanupAfterDays ?? 7,
      enableLogging: options.enableLogging ?? false,
    };
  }

  /**
   * Saves a message to the outbox
   */
  async saveMessage<T = any>(
    messageType: string,
    payload: T,
    options?: OutboxMessageOptions,
  ): Promise<string> {
    const message = OutboxMessageFactory.createMessage(messageType, payload, {
      priority: this.options.defaultPriority,
      metadata: { ...this.options.defaultMetadata, ...options?.metadata },
      ...options,
    });

    const messageId = await this.repository.saveMessage(message);
    this.logger.debug(`Saved message ${messageId} of type ${messageType}`);
    return messageId;
  }

  /**
   * Saves multiple messages to the outbox in a batch
   */
  async saveMessages<T = any>(
    messages: Array<{
      messageType: string;
      payload: T;
      options?: OutboxMessageOptions;
    }>,
  ): Promise<string[]> {
    const outboxMessages = messages.map(({ messageType, payload, options }) =>
      OutboxMessageFactory.createMessage(messageType, payload, {
        priority: this.options.defaultPriority,
        metadata: { ...this.options.defaultMetadata, ...options?.metadata },
        ...options,
      }),
    );

    const messageIds = await this.repository.saveBatch(outboxMessages);
    this.logger.debug(`Saved batch of ${messages.length} messages`);
    return messageIds;
  }

  /**
   * Schedules a message for delayed processing
   */
  async scheduleMessage<T = any>(
    messageType: string,
    payload: T,
    delayMs: number,
    options?: OutboxMessageOptions,
  ): Promise<string> {
    const message = OutboxMessageFactory.createDelayedMessage(
      messageType,
      payload,
      delayMs,
      {
        priority: this.options.defaultPriority,
        metadata: { ...this.options.defaultMetadata, ...options?.metadata },
        ...options,
      },
    );

    const messageId = await this.repository.scheduleMessage(message, message.processAfter as Date);
    this.logger.debug(
      `Scheduled message ${messageId} of type ${messageType} for processing in ${delayMs}ms`,
    );
    return messageId;
  }

  /**
   * Saves a high priority message to the outbox
   */
  async saveHighPriorityMessage<T = any>(
    messageType: string,
    payload: T,
    options?: OutboxMessageOptions,
  ): Promise<string> {
    return this.saveMessage(messageType, payload, {
      ...options,
      priority: MessagePriority.HIGH,
    });
  }

  /**
   * Saves a critical priority message to the outbox
   */
  async saveCriticalMessage<T = any>(
    messageType: string,
    payload: T,
    options?: OutboxMessageOptions,
  ): Promise<string> {
    return this.saveMessage(messageType, payload, {
      ...options,
      priority: MessagePriority.CRITICAL,
    });
  }

  /**
   * Converts a domain event to an outbox message and saves it
   */
  async saveDomainEvent(
    event: IExtendedDomainEvent,
    options?: OutboxMessageOptions,
  ): Promise<string> {
    const message = OutboxMessageFactory.createFromIntegrationEvent(
      {
        eventType: event.eventType,
        payload: event,
        metadata: {
          eventId: event?.metadata?.eventId,
          occurredOn: event?.metadata?.occurredOn,
          version: event?.metadata?.version,
        },
      },
      {
        priority: this.options.defaultPriority,
        metadata: { ...this.options.defaultMetadata, ...options?.metadata },
        ...options,
      },
    );

    const messageId = await this.repository.saveMessage(message);
    this.logger.debug(`Saved domain event ${event.eventType} as message ${messageId}`);
    return messageId;
  }

  /**
   * Gets a message by ID
   */
  async getMessage(id: string): Promise<IOutboxMessage | null> {
    return this.repository.getById(id);
  }

  /**
   * Gets pending messages (for monitoring purposes)
   */
  async getPendingMessages(limit = 100): Promise<IOutboxMessage[]> {
    return this.repository.getUnprocessedMessages(limit);
  }

  /**
   * Retries a failed message by resetting it to pending status
   */
  async retryMessage(id: string): Promise<void> {
    await this.repository.updateStatus(id, MessageStatus.PENDING);
    this.logger.info(`Reset message ${id} to pending for retry`);
  }

  /**
   * Retries multiple failed messages
   */
  async retryMessages(ids: string[]): Promise<void> {
    await this.repository.updateStatusBatch(ids, MessageStatus.PENDING);
    this.logger.info(`Reset ${ids.length} messages to pending for retry`);
  }

  /**
   * Cleans up old processed messages
   */
  async cleanup(olderThanDays?: number): Promise<number> {
    const days = olderThanDays ?? this.options.cleanupAfterDays;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const deletedCount = await this.repository.deleteByStatusAndAge(cutoffDate, MessageStatus.PROCESSED);
    this.logger.info(`Cleaned up ${deletedCount} processed messages older than ${days} days`);
    return deletedCount;
  }

  /**
   * Gets outbox statistics
   */
  async getStats(): Promise<{
    totalPending: number;
    totalProcessing: number;
    totalProcessed: number;
    totalFailed: number;
  }> {
    // Check if repository has helper methods (for InMemoryOutboxRepository)
    const repo = this.repository as any;
    if (repo.getMessageCountByStatus) {
      return {
        totalPending: repo.getMessageCountByStatus(MessageStatus.PENDING),
        totalProcessing: repo.getMessageCountByStatus(MessageStatus.PROCESSING),
        totalProcessed: repo.getMessageCountByStatus(MessageStatus.PROCESSED),
        totalFailed: repo.getMessageCountByStatus(MessageStatus.FAILED),
      };
    }

    // Fallback implementation - only returns pending count
    const pendingMessages = await this.repository.getUnprocessedMessages(1000);
    return {
      totalPending: pendingMessages.length,
      totalProcessing: 0, // Would need separate query
      totalProcessed: 0, // Would need separate query
      totalFailed: 0, // Would need separate query
    };
  }

  /**
   * Logs messages if logging is enabled
   */
  private log(message: string): void {
    if (this.options.enableLogging) {
      this.logger.info(message);
    }
  }
}
