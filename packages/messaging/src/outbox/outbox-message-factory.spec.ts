/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect } from 'vitest';
import { OutboxMessageFactory } from './outbox-message-factory';
import { MessageStatus, MessagePriority } from './outbox-interfaces';

describe('OutboxMessageFactory', () => {
  describe('createMessage', () => {
    it('should create a basic outbox message', () => {
      const messageType = 'TestMessage';
      const payload = { data: 'test' };

      const message = OutboxMessageFactory.createMessage(messageType, payload);

      expect(message.id).toBeDefined();
      expect(message.messageType).toBe(messageType);
      expect(message.payload).toEqual(payload);
      expect(message.metadata).toEqual({});
      expect(message.status).toBe(MessageStatus.PENDING);
      expect(message.attempts).toBe(0);
      expect(message.createdAt).toBeInstanceOf(Date);
      expect(message.priority).toBe(MessagePriority.NORMAL);
      expect(message.processAfter).toBeUndefined();
    });

    it('should create message with custom options', () => {
      const messageType = 'TestMessage';
      const payload = { data: 'test' };
      const processAfter = new Date(Date.now() + 5000);
      const metadata = { correlationId: '123' };

      const message = OutboxMessageFactory.createMessage(messageType, payload, {
        processAfter,
        priority: MessagePriority.HIGH,
        metadata,
      });

      expect(message.processAfter).toEqual(processAfter);
      expect(message.priority).toBe(MessagePriority.HIGH);
      expect(message.metadata).toEqual(metadata);
    });
  });

  describe('createDelayedMessage', () => {
    it('should create a delayed message', () => {
      const messageType = 'DelayedMessage';
      const payload = { data: 'delayed' };
      const delayMs = 10000;
      const beforeCreate = Date.now();

      const message = OutboxMessageFactory.createDelayedMessage(messageType, payload, delayMs);

      const afterCreate = Date.now();
      const expectedProcessAfter = beforeCreate + delayMs;

      expect(message.processAfter).toBeDefined();
      expect(message.processAfter!.getTime()).toBeGreaterThanOrEqual(expectedProcessAfter);
      expect(message.processAfter!.getTime()).toBeLessThanOrEqual(afterCreate + delayMs);
    });
  });

  describe('createHighPriorityMessage', () => {
    it('should create a high priority message', () => {
      const messageType = 'HighPriorityMessage';
      const payload = { urgent: true };

      const message = OutboxMessageFactory.createHighPriorityMessage(messageType, payload);

      expect(message.priority).toBe(MessagePriority.HIGH);
      expect(message.messageType).toBe(messageType);
      expect(message.payload).toEqual(payload);
    });
  });

  describe('createFromIntegrationEvent', () => {
    it('should create message from integration event', () => {
      const event = {
        eventType: 'OrderCreated',
        payload: { orderId: '123', amount: 100 },
        metadata: { source: 'order-service' },
      };

      const message = OutboxMessageFactory.createFromIntegrationEvent(event);

      expect(message.messageType).toBe('integration_event:OrderCreated');
      expect(message.payload).toEqual(event.payload);
      expect(message.metadata).toEqual(event.metadata);
    });

    it('should merge metadata correctly', () => {
      const event = {
        eventType: 'OrderCreated',
        payload: { orderId: '123' },
        metadata: { source: 'order-service' },
      };

      const options = {
        metadata: { correlationId: 'abc123' },
        priority: MessagePriority.HIGH,
      };

      const message = OutboxMessageFactory.createFromIntegrationEvent(event, options);

      expect(message.metadata).toEqual({
        source: 'order-service',
        correlationId: 'abc123',
      });
      expect(message.priority).toBe(MessagePriority.HIGH);
    });
  });
});
