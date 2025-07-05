/* eslint-disable @typescript-eslint/no-explicit-any */
import { LibUtils } from '@vytches-ddd/utils';

import type { IOutboxMessage, OutboxMessageOptions } from './outbox-interfaces';
import { MessageStatus, MessagePriority } from './outbox-interfaces';

/**
 * Factory for creating outbox messages
 * Provides utility methods for creating different types of messages
 */
export class OutboxMessageFactory {
  /**
   * Creates a new outbox message
   * @param messageType Type of the message
   * @param payload Message payload
   * @param options Additional options
   * @returns Outbox message
   */
  static createMessage<T = any>(
    messageType: string,
    payload: T,
    options?: OutboxMessageOptions
  ): IOutboxMessage<T> {
    const message: IOutboxMessage<T> = {
      id: LibUtils.getUUID(),
      messageType,
      payload,
      metadata: options?.metadata || {},
      status: MessageStatus.PENDING,
      attempts: 0,
      createdAt: new Date(),
      priority: options?.priority || MessagePriority.NORMAL,
    };

    if (options?.processAfter) {
      message.processAfter = options.processAfter;
    }

    return message;
  }

  /**
   * Creates a delayed outbox message
   * @param messageType Type of the message
   * @param payload Message payload
   * @param delayMs Delay in milliseconds
   * @param options Additional options
   * @returns Outbox message scheduled for later processing
   */
  static createDelayedMessage<T = any>(
    messageType: string,
    payload: T,
    delayMs: number,
    options?: OutboxMessageOptions
  ): IOutboxMessage<T> {
    const processAfter = new Date(Date.now() + delayMs);

    return OutboxMessageFactory.createMessage(messageType, payload, {
      ...options,
      processAfter,
    });
  }

  /**
   * Creates a high priority outbox message
   * @param messageType Type of the message
   * @param payload Message payload
   * @param options Additional options
   * @returns High priority outbox message
   */
  static createHighPriorityMessage<T = any>(
    messageType: string,
    payload: T,
    options?: OutboxMessageOptions
  ): IOutboxMessage<T> {
    return OutboxMessageFactory.createMessage(messageType, payload, {
      ...options,
      priority: MessagePriority.HIGH,
    });
  }

  /**
   * Creates an outbox message from an integration event
   * @param event Integration event
   * @param options Additional options
   * @returns Outbox message containing the integration event
   */
  static createFromIntegrationEvent<T = any>(
    event: { eventType: string; payload?: T; metadata?: Record<string, any> },
    options?: OutboxMessageOptions
  ): IOutboxMessage<T> {
    const mergedOptions: OutboxMessageOptions = {
      metadata: {
        ...(event.metadata || {}),
        ...(options?.metadata || {}),
      },
    };

    if (options?.priority) {
      mergedOptions.priority = options.priority;
    }

    if (options?.processAfter) {
      mergedOptions.processAfter = options.processAfter;
    }

    return OutboxMessageFactory.createMessage(
      `integration_event:${event.eventType}`,
      event.payload as T,
      mergedOptions
    );
  }
}
