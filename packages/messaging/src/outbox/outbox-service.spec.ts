import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OutboxService } from './outbox-service';
import type { IOutboxRepository } from './outbox-repository.interface';
import { MessageStatus, MessagePriority } from './outbox-interfaces';

describe('OutboxService', () => {
  let outboxService: OutboxService;
  let mockRepository: IOutboxRepository;

  beforeEach(() => {
    mockRepository = {
      saveMessage: vi.fn().mockResolvedValue('message-id-123'),
      saveBatch: vi.fn().mockResolvedValue(['id1', 'id2', 'id3']),
      getUnprocessedMessages: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      updateStatusBatch: vi.fn().mockResolvedValue(undefined),
      incrementAttempt: vi.fn().mockResolvedValue(1),
      deleteByStatusAndAge: vi.fn().mockResolvedValue(5),
      scheduleMessage: vi.fn().mockResolvedValue('scheduled-id-456'),
    };

    outboxService = new OutboxService(mockRepository);
  });

  describe('saveMessage', () => {
    it('should save a message to the outbox', async () => {
      const messageType = 'TestMessage';
      const payload = { data: 'test' };

      const messageId = await outboxService.saveMessage(messageType, payload);

      expect(messageId).toBe('message-id-123');
      expect(mockRepository.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType,
          payload,
          status: MessageStatus.PENDING,
          attempts: 0,
          priority: MessagePriority.NORMAL,
        }),
      );
    });

    it('should save message with custom options', async () => {
      const messageType = 'TestMessage';
      const payload = { data: 'test' };
      const options = {
        priority: MessagePriority.HIGH,
        metadata: { correlationId: '123' },
      };

      await outboxService.saveMessage(messageType, payload, options);

      expect(mockRepository.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType,
          payload,
          priority: MessagePriority.HIGH,
          metadata: expect.objectContaining({ correlationId: '123' }),
        }),
      );
    });
  });

  describe('saveMessages', () => {
    it('should save multiple messages in batch', async () => {
      const messages = [
        { messageType: 'Message1', payload: { data: 1 } },
        { messageType: 'Message2', payload: { data: 2 } },
        { messageType: 'Message3', payload: { data: 3 } },
      ];

      const messageIds = await outboxService.saveMessages(messages);

      expect(messageIds).toEqual(['id1', 'id2', 'id3']);
      expect(mockRepository.saveBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ messageType: 'Message1' }),
          expect.objectContaining({ messageType: 'Message2' }),
          expect.objectContaining({ messageType: 'Message3' }),
        ]),
      );
    });
  });

  describe('scheduleMessage', () => {
    it('should schedule a message for delayed processing', async () => {
      const messageType = 'DelayedMessage';
      const payload = { data: 'delayed' };
      const delayMs = 5000;

      const messageId = await outboxService.scheduleMessage(
        messageType,
        payload,
        delayMs,
      );

      expect(messageId).toBe('scheduled-id-456');
      expect(mockRepository.scheduleMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType,
          payload,
          processAfter: expect.any(Date),
        }),
        expect.any(Date),
      );
    });
  });

  describe('saveHighPriorityMessage', () => {
    it('should save message with high priority', async () => {
      const messageType = 'HighPriorityMessage';
      const payload = { urgent: true };

      await outboxService.saveHighPriorityMessage(messageType, payload);

      expect(mockRepository.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType,
          payload,
          priority: MessagePriority.HIGH,
        }),
      );
    });
  });

  describe('saveCriticalMessage', () => {
    it('should save message with critical priority', async () => {
      const messageType = 'CriticalMessage';
      const payload = { critical: true };

      await outboxService.saveCriticalMessage(messageType, payload);

      expect(mockRepository.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType,
          payload,
          priority: MessagePriority.CRITICAL,
        }),
      );
    });
  });

  describe('saveDomainEvent', () => {
    it('should save domain event as outbox message', async () => {
      const domainEvent = {
        eventType: 'OrderCreated',
        orderId: 'order-123',
        amount: 100,
        metadata: {
          eventId: 'event-123',
          occurredOn: new Date(),
          version: 1,
        },
      };

      const messageId = await outboxService.saveDomainEvent(domainEvent);

      expect(messageId).toBe('message-id-123');
      expect(mockRepository.saveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          messageType: 'integration_event:OrderCreated',
          payload: domainEvent,
          metadata: expect.objectContaining({
            eventId: 'event-123',
          }),
        }),
      );
    });
  });

  describe('getMessage', () => {
    it('should retrieve message by ID', async () => {
      const testMessage = {
        id: 'test-id',
        messageType: 'TestMessage',
        payload: { data: 'test' },
        metadata: {},
        status: MessageStatus.PENDING,
        attempts: 0,
        createdAt: new Date(),
      };

      mockRepository.getById = vi.fn().mockResolvedValue(testMessage);

      const retrievedMessage = await outboxService.getMessage('test-id');

      expect(retrievedMessage).toEqual(testMessage);
      expect(mockRepository.getById).toHaveBeenCalledWith('test-id');
    });

    it('should return null for non-existent message', async () => {
      const result = await outboxService.getMessage('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getPendingMessages', () => {
    it('should retrieve pending messages', async () => {
      const pendingMessages = [
        { id: '1', status: MessageStatus.PENDING },
        { id: '2', status: MessageStatus.PENDING },
      ];

      mockRepository.getUnprocessedMessages = vi.fn().mockResolvedValue(pendingMessages);

      const result = await outboxService.getPendingMessages();

      expect(result).toEqual(pendingMessages);
      expect(mockRepository.getUnprocessedMessages).toHaveBeenCalledWith(100);
    });
  });

  describe('retryMessage', () => {
    it('should reset failed message to pending', async () => {
      await outboxService.retryMessage('failed-message-id');

      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        'failed-message-id',
        MessageStatus.PENDING,
      );
    });
  });

  describe('retryMessages', () => {
    it('should reset multiple failed messages to pending', async () => {
      const messageIds = ['id1', 'id2'];

      await outboxService.retryMessages(messageIds);

      expect(mockRepository.updateStatusBatch).toHaveBeenCalledWith(
        messageIds,
        MessageStatus.PENDING,
      );
    });
  });

  describe('cleanup', () => {
    it('should clean up old processed messages', async () => {
      const deletedCount = await outboxService.cleanup(7);

      expect(deletedCount).toBe(5);
      expect(mockRepository.deleteByStatusAndAge).toHaveBeenCalledWith(
        expect.any(Date),
        MessageStatus.PROCESSED,
      );
    });
  });

  describe('getStats', () => {
    it('should return outbox statistics', async () => {
      const pendingMessages = [
        { status: MessageStatus.PENDING },
        { status: MessageStatus.PENDING },
      ];

      mockRepository.getUnprocessedMessages = vi.fn().mockResolvedValue(pendingMessages);

      const stats = await outboxService.getStats();

      expect(stats.totalPending).toBe(2);
      expect(stats.totalProcessing).toBe(0);
      expect(stats.totalProcessed).toBe(0);
      expect(stats.totalFailed).toBe(0);
    });
  });
});
