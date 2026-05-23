import { describe, it, expect, beforeEach } from 'vitest';
import { MessagePriority, MessageStatus, type IOutboxMessage } from '@vytches/ddd-messaging';

import { InMemoryOutboxRepository } from '../../src/outbox';

const buildMessage = (overrides: Partial<IOutboxMessage> = {}): IOutboxMessage => ({
  id: '',
  messageType: 'test.event',
  payload: { hello: 'world' },
  metadata: {},
  status: MessageStatus.PENDING,
  attempts: 0,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('InMemoryOutboxRepository', () => {
  let repo: InMemoryOutboxRepository;

  beforeEach(() => {
    repo = new InMemoryOutboxRepository();
  });

  describe('saveMessage', () => {
    it('generates an id when none is provided and returns it', async () => {
      const id = await repo.saveMessage(buildMessage());
      expect(id).toMatch(/^outbox-\d+$/);
      expect(await repo.getById(id)).not.toBeNull();
    });

    it('preserves a caller-supplied id', async () => {
      const id = await repo.saveMessage(buildMessage({ id: 'explicit-id' }));
      expect(id).toBe('explicit-id');
    });

    it('stores the message so it can be retrieved', async () => {
      const id = await repo.saveMessage(buildMessage({ id: 'm-1', messageType: 'order.placed' }));
      const stored = await repo.getById(id);
      expect(stored?.messageType).toBe('order.placed');
    });
  });

  describe('saveBatch', () => {
    it('saves multiple messages and returns their ids in order', async () => {
      const ids = await repo.saveBatch([
        buildMessage({ id: 'a' }),
        buildMessage({ id: 'b' }),
        buildMessage({ id: 'c' }),
      ]);
      expect(ids).toEqual(['a', 'b', 'c']);
      expect(repo.size()).toBe(3);
    });
  });

  describe('getUnprocessedMessages', () => {
    it('returns only PENDING messages', async () => {
      await repo.saveMessage(buildMessage({ id: 'pending' }));
      await repo.saveMessage(buildMessage({ id: 'processed', status: MessageStatus.PROCESSED }));
      await repo.saveMessage(buildMessage({ id: 'failed', status: MessageStatus.FAILED }));

      const result = await repo.getUnprocessedMessages();
      expect(result.map(m => m.id)).toEqual(['pending']);
    });

    it('respects the limit', async () => {
      for (let i = 0; i < 5; i++) await repo.saveMessage(buildMessage({ id: `m-${i}` }));
      const result = await repo.getUnprocessedMessages(2);
      expect(result).toHaveLength(2);
    });

    it('orders by priority (CRITICAL first)', async () => {
      await repo.saveMessage(buildMessage({ id: 'low', priority: MessagePriority.LOW }));
      await repo.saveMessage(buildMessage({ id: 'critical', priority: MessagePriority.CRITICAL }));
      await repo.saveMessage(buildMessage({ id: 'normal', priority: MessagePriority.NORMAL }));

      const result = await repo.getUnprocessedMessages();
      expect(result.map(m => m.id)).toEqual(['critical', 'normal', 'low']);
    });

    it('breaks priority ties by createdAt (oldest first)', async () => {
      await repo.saveMessage(
        buildMessage({ id: 'newer', createdAt: new Date('2026-01-02T00:00:00Z') })
      );
      await repo.saveMessage(
        buildMessage({ id: 'older', createdAt: new Date('2026-01-01T00:00:00Z') })
      );

      const result = await repo.getUnprocessedMessages();
      expect(result.map(m => m.id)).toEqual(['older', 'newer']);
    });

    it('filters by messageTypes when provided', async () => {
      await repo.saveMessage(buildMessage({ id: 'a', messageType: 'type.A' }));
      await repo.saveMessage(buildMessage({ id: 'b', messageType: 'type.B' }));

      const result = await repo.getUnprocessedMessages(100, undefined, ['type.A']);
      expect(result.map(m => m.id)).toEqual(['a']);
    });

    it('returns all types when messageTypes is omitted', async () => {
      await repo.saveMessage(buildMessage({ id: 'a', messageType: 'type.A' }));
      await repo.saveMessage(buildMessage({ id: 'b', messageType: 'type.B' }));

      const result = await repo.getUnprocessedMessages();
      expect(result).toHaveLength(2);
    });

    it('excludes messages whose processAfter is in the future', async () => {
      const clockRepo = new InMemoryOutboxRepository({ clock: () => 1000 });
      await clockRepo.saveMessage(buildMessage({ id: 'future', processAfter: new Date(2000) }));
      await clockRepo.saveMessage(buildMessage({ id: 'ready', processAfter: new Date(500) }));
      await clockRepo.saveMessage(buildMessage({ id: 'no-delay' }));

      const result = await clockRepo.getUnprocessedMessages();
      expect(result.map(m => m.id).sort()).toEqual(['no-delay', 'ready']);
    });
  });

  describe('getById', () => {
    it('returns null for an unknown id', async () => {
      expect(await repo.getById('nope')).toBeNull();
    });

    it('returns a copy that does not corrupt internal state when mutated', async () => {
      await repo.saveMessage(buildMessage({ id: 'm-1' }));
      const first = await repo.getById('m-1');
      first!.status = MessageStatus.FAILED;

      const second = await repo.getById('m-1');
      expect(second?.status).toBe(MessageStatus.PENDING);
    });
  });

  describe('updateStatus', () => {
    it('changes the status', async () => {
      await repo.saveMessage(buildMessage({ id: 'm-1' }));
      await repo.updateStatus('m-1', MessageStatus.PROCESSED);
      expect((await repo.getById('m-1'))?.status).toBe(MessageStatus.PROCESSED);
    });

    it('records the error message when an error is passed', async () => {
      await repo.saveMessage(buildMessage({ id: 'm-1' }));
      await repo.updateStatus('m-1', MessageStatus.FAILED, new Error('kaboom'));
      expect((await repo.getById('m-1'))?.lastError).toBe('kaboom');
    });

    it('is a no-op for an unknown id', async () => {
      await expect(repo.updateStatus('ghost', MessageStatus.PROCESSED)).resolves.toBeUndefined();
    });
  });

  describe('updateStatusBatch', () => {
    it('updates the status of every provided id', async () => {
      await repo.saveBatch([buildMessage({ id: 'a' }), buildMessage({ id: 'b' })]);
      await repo.updateStatusBatch(['a', 'b'], MessageStatus.PROCESSED);

      expect((await repo.getById('a'))?.status).toBe(MessageStatus.PROCESSED);
      expect((await repo.getById('b'))?.status).toBe(MessageStatus.PROCESSED);
    });
  });

  describe('incrementAttempt', () => {
    it('increments the attempt counter and returns the new value', async () => {
      await repo.saveMessage(buildMessage({ id: 'm-1', attempts: 2 }));
      const attempts = await repo.incrementAttempt('m-1');
      expect(attempts).toBe(3);
      expect((await repo.getById('m-1'))?.attempts).toBe(3);
    });

    it('returns 0 for an unknown id', async () => {
      expect(await repo.incrementAttempt('ghost')).toBe(0);
    });
  });

  describe('deleteByStatusAndAge', () => {
    it('deletes only messages of the given status older than the threshold', async () => {
      await repo.saveMessage(
        buildMessage({
          id: 'old-processed',
          status: MessageStatus.PROCESSED,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        })
      );
      await repo.saveMessage(
        buildMessage({
          id: 'new-processed',
          status: MessageStatus.PROCESSED,
          createdAt: new Date('2026-03-01T00:00:00Z'),
        })
      );
      await repo.saveMessage(
        buildMessage({
          id: 'old-pending',
          status: MessageStatus.PENDING,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        })
      );

      const deleted = await repo.deleteByStatusAndAge(
        new Date('2026-02-01T00:00:00Z'),
        MessageStatus.PROCESSED
      );

      expect(deleted).toBe(1);
      expect(await repo.getById('old-processed')).toBeNull();
      expect(await repo.getById('new-processed')).not.toBeNull();
      expect(await repo.getById('old-pending')).not.toBeNull();
    });
  });

  describe('scheduleMessage', () => {
    it('stores the message with the given processAfter', async () => {
      const processAfter = new Date('2026-06-01T00:00:00Z');
      const id = await repo.scheduleMessage(buildMessage({ id: 'delayed' }), processAfter);
      expect((await repo.getById(id))?.processAfter).toEqual(processAfter);
    });
  });

  describe('scheduleRetry', () => {
    it('resets the message to PENDING and sets processAfter', async () => {
      await repo.saveMessage(buildMessage({ id: 'm-1', status: MessageStatus.PROCESSING }));
      const processAfter = new Date('2026-06-01T00:00:00Z');

      await repo.scheduleRetry('m-1', processAfter);

      const stored = await repo.getById('m-1');
      expect(stored?.status).toBe(MessageStatus.PENDING);
      expect(stored?.processAfter).toEqual(processAfter);
    });

    it('is a no-op for an unknown id', async () => {
      await expect(repo.scheduleRetry('ghost', new Date())).resolves.toBeUndefined();
    });
  });

  describe('resetStaleProcessing', () => {
    it('resets only PROCESSING messages older than the threshold', async () => {
      let now = 1000;
      const clockRepo = new InMemoryOutboxRepository({ clock: () => now });

      await clockRepo.saveMessage(buildMessage({ id: 'stale' }));
      await clockRepo.saveMessage(buildMessage({ id: 'fresh' }));

      // 'stale' enters PROCESSING at t=1000
      await clockRepo.updateStatus('stale', MessageStatus.PROCESSING);
      // time advances; 'fresh' enters PROCESSING at t=5000
      now = 5000;
      await clockRepo.updateStatus('fresh', MessageStatus.PROCESSING);

      // reset anything processing since before t=3000
      const reset = await clockRepo.resetStaleProcessing(new Date(3000));

      expect(reset).toBe(1);
      expect((await clockRepo.getById('stale'))?.status).toBe(MessageStatus.PENDING);
      expect((await clockRepo.getById('fresh'))?.status).toBe(MessageStatus.PROCESSING);
    });

    it('ignores PENDING and PROCESSED messages', async () => {
      const clockRepo = new InMemoryOutboxRepository({ clock: () => 1000 });
      await clockRepo.saveMessage(buildMessage({ id: 'pending' }));
      await clockRepo.saveMessage(
        buildMessage({ id: 'processed', status: MessageStatus.PROCESSED })
      );

      const reset = await clockRepo.resetStaleProcessing(new Date(5000));
      expect(reset).toBe(0);
    });

    it('returns 0 when nothing is stale', async () => {
      let now = 1000;
      const clockRepo = new InMemoryOutboxRepository({ clock: () => now });
      await clockRepo.saveMessage(buildMessage({ id: 'm-1' }));
      await clockRepo.updateStatus('m-1', MessageStatus.PROCESSING);
      now = 1500;

      // threshold is before the message started processing → not stale
      const reset = await clockRepo.resetStaleProcessing(new Date(500));
      expect(reset).toBe(0);
      expect((await clockRepo.getById('m-1'))?.status).toBe(MessageStatus.PROCESSING);
    });

    it('clears processing-since tracking when a message leaves PROCESSING', async () => {
      let now = 1000;
      const clockRepo = new InMemoryOutboxRepository({ clock: () => now });
      await clockRepo.saveMessage(buildMessage({ id: 'm-1' }));
      await clockRepo.updateStatus('m-1', MessageStatus.PROCESSING);
      await clockRepo.updateStatus('m-1', MessageStatus.PROCESSED);
      now = 9999;

      // even with a generous threshold, a PROCESSED message is never reset
      const reset = await clockRepo.resetStaleProcessing(new Date(9000));
      expect(reset).toBe(0);
    });
  });

  describe('test helpers', () => {
    it('getAll returns copies of all stored messages', async () => {
      await repo.saveMessage(buildMessage({ id: 'm-1' }));
      const all = repo.getAll();
      all[0]!.status = MessageStatus.FAILED;
      expect((await repo.getById('m-1'))?.status).toBe(MessageStatus.PENDING);
    });

    it('clear removes everything for test isolation', async () => {
      await repo.saveBatch([buildMessage({ id: 'a' }), buildMessage({ id: 'b' })]);
      repo.clear();
      expect(repo.size()).toBe(0);
      expect(await repo.getUnprocessedMessages()).toEqual([]);
    });
  });
});
