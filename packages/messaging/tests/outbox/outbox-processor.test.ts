import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  MessagePriority,
  MessageStatus,
  type IOutboxMessage,
  type IOutboxMessageHandler,
} from '../../src/outbox/outbox-interfaces';
import { OutboxProcessor } from '../../src/outbox/outbox-processor';
import { IOutboxRepository } from '../../src/outbox/outbox-repository.interface';

class InMemoryOutboxRepository extends IOutboxRepository {
  store = new Map<string, IOutboxMessage>();
  private nextId = 1;

  async saveMessage<T>(message: IOutboxMessage<T>): Promise<string> {
    const id = message.id || `msg-${this.nextId++}`;
    const stored = { ...message, id } as IOutboxMessage;
    this.store.set(id, stored);
    return id;
  }

  async saveBatch<T>(messages: IOutboxMessage<T>[]): Promise<string[]> {
    return Promise.all(messages.map(m => this.saveMessage(m)));
  }

  async getUnprocessedMessages(
    limit = 10,
    priorityOrder: MessagePriority[] = [
      MessagePriority.CRITICAL,
      MessagePriority.HIGH,
      MessagePriority.NORMAL,
      MessagePriority.LOW,
    ]
  ): Promise<IOutboxMessage[]> {
    const pending = Array.from(this.store.values()).filter(m => m.status === MessageStatus.PENDING);

    const sorted = pending.sort((a, b) => {
      const aPrio = priorityOrder.indexOf(a.priority ?? MessagePriority.NORMAL);
      const bPrio = priorityOrder.indexOf(b.priority ?? MessagePriority.NORMAL);
      if (aPrio !== bPrio) return aPrio - bPrio;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    return sorted.slice(0, limit);
  }

  async getById(id: string): Promise<IOutboxMessage | null> {
    return this.store.get(id) ?? null;
  }

  async updateStatus(id: string, status: MessageStatus, error?: Error): Promise<void> {
    const m = this.store.get(id);
    if (!m) return;
    this.store.set(id, {
      ...m,
      status,
      ...(error ? { lastError: error.message } : {}),
    });
  }

  async updateStatusBatch(ids: string[], status: MessageStatus): Promise<void> {
    for (const id of ids) await this.updateStatus(id, status);
  }

  async incrementAttempt(id: string): Promise<number> {
    const m = this.store.get(id);
    if (!m) return 0;
    const attempts = m.attempts + 1;
    this.store.set(id, { ...m, attempts });
    return attempts;
  }

  async deleteByStatusAndAge(olderThan: Date, status: MessageStatus): Promise<number> {
    let deleted = 0;
    for (const [id, m] of this.store) {
      if (m.status === status && m.createdAt < olderThan) {
        this.store.delete(id);
        deleted++;
      }
    }
    return deleted;
  }

  async scheduleMessage<T>(message: IOutboxMessage<T>, processAfter: Date): Promise<string> {
    return this.saveMessage({ ...message, processAfter });
  }
}

const buildMessage = (overrides: Partial<IOutboxMessage> = {}): IOutboxMessage => ({
  id: '',
  messageType: 'test.event',
  payload: { hello: 'world' },
  metadata: {},
  status: MessageStatus.PENDING,
  attempts: 0,
  createdAt: new Date(),
  ...overrides,
});

describe('OutboxProcessor — sequence integration', () => {
  let repo: InMemoryOutboxRepository;
  let processor: OutboxProcessor;

  beforeEach(() => {
    repo = new InMemoryOutboxRepository();
    processor = new OutboxProcessor(repo, {
      batchSize: 5,
      maxRetries: 3,
      processingInterval: 1000,
      messageTimeout: 5000,
    });
  });

  describe('happy path — single message lifecycle', () => {
    it('moves PENDING → PROCESSING → PROCESSED on successful handler run', async () => {
      const handler: IOutboxMessageHandler = { handle: vi.fn().mockResolvedValue(undefined) };
      processor.registerHandler('test.event', handler);
      processor.start();

      const id = await repo.saveMessage(buildMessage({ id: 'm-1' }));
      await processor.processBatch();

      expect(repo.store.get(id)?.status).toBe(MessageStatus.PROCESSED);
      expect(handler.handle).toHaveBeenCalledOnce();
    });

    it('processes multiple messages in priority order (CRITICAL first)', async () => {
      const handlerCalls: string[] = [];
      processor.registerHandler('test.event', {
        handle: async msg => {
          handlerCalls.push(`${msg.priority ?? 'normal'}:${msg.id}`);
        },
      });
      processor.start();

      await repo.saveMessage(buildMessage({ id: 'm-low', priority: MessagePriority.LOW }));
      await repo.saveMessage(
        buildMessage({ id: 'm-critical', priority: MessagePriority.CRITICAL })
      );
      await repo.saveMessage(buildMessage({ id: 'm-normal', priority: MessagePriority.NORMAL }));

      await processor.processBatch();

      // CRITICAL should be processed first based on priority order
      expect(handlerCalls[0]).toBe('critical:m-critical');
    });
  });

  describe('failure / retry path', () => {
    it('increments attempts on failure, resets to PENDING for retry', async () => {
      processor.registerHandler('test.event', {
        handle: async () => {
          throw new Error('boom');
        },
      });
      processor.start();

      const id = await repo.saveMessage(buildMessage({ id: 'm-fail' }));
      await processor.processBatch();

      const stored = repo.store.get(id)!;
      expect(stored.attempts).toBe(1);
      expect(stored.status).toBe(MessageStatus.PENDING); // ready for retry
    });

    it('marks FAILED after maxRetries reached', async () => {
      processor.registerHandler('test.event', {
        handle: async () => {
          throw new Error('persistent failure');
        },
      });
      processor.start();

      const id = await repo.saveMessage(buildMessage({ id: 'm-fail' }));

      await processor.processBatch();
      await processor.processBatch();
      await processor.processBatch();

      const stored = repo.store.get(id)!;
      expect(stored.attempts).toBe(3);
      expect(stored.status).toBe(MessageStatus.FAILED);
      expect(stored.lastError).toContain('persistent failure');
    });

    it('throws when handler is missing for a message type', async () => {
      // Don't register a handler for "test.event"
      processor.start();

      const id = await repo.saveMessage(buildMessage({ id: 'm-orphan' }));
      await processor.processBatch();

      const stored = repo.store.get(id)!;
      // Missing handler is treated as failure → attempts incremented
      expect(stored.attempts).toBe(1);
    });
  });

  describe('middleware pipeline', () => {
    it('runs middleware in registration order, around the handler', async () => {
      const log: string[] = [];

      processor.use(next => async msg => {
        log.push('before-1');
        await next(msg);
        log.push('after-1');
      });
      processor.use(next => async msg => {
        log.push('before-2');
        await next(msg);
        log.push('after-2');
      });
      processor.registerHandler('test.event', {
        handle: async () => {
          log.push('handler');
        },
      });
      processor.start();

      await repo.saveMessage(buildMessage({ id: 'm-1' }));
      await processor.processBatch();

      expect(log).toEqual(['before-1', 'before-2', 'handler', 'after-2', 'after-1']);
    });

    it('middleware can short-circuit by not calling next()', async () => {
      let handlerCalled = false;
      processor.use(_next => async () => {
        // intentionally do not call next
      });
      processor.registerHandler('test.event', {
        handle: async () => {
          handlerCalled = true;
        },
      });
      processor.start();

      const id = await repo.saveMessage(buildMessage({ id: 'm-1' }));
      await processor.processBatch();

      expect(handlerCalled).toBe(false);
      // message marked PROCESSED because no error was thrown
      expect(repo.store.get(id)?.status).toBe(MessageStatus.PROCESSED);
    });
  });

  describe('start/stop lifecycle', () => {
    it('processBatch is no-op when processor is not running', async () => {
      const handler: IOutboxMessageHandler = { handle: vi.fn() };
      processor.registerHandler('test.event', handler);

      const id = await repo.saveMessage(buildMessage({ id: 'm-1' }));
      await processor.processBatch(); // not started

      expect(handler.handle).not.toHaveBeenCalled();
      expect(repo.store.get(id)?.status).toBe(MessageStatus.PENDING);
    });

    it('start() then stop() — processBatch becomes no-op again', async () => {
      const handler: IOutboxMessageHandler = { handle: vi.fn() };
      processor.registerHandler('test.event', handler);

      processor.start();
      processor.stop();

      await repo.saveMessage(buildMessage({ id: 'm-1' }));
      await processor.processBatch();

      expect(handler.handle).not.toHaveBeenCalled();
    });

    it('getStats returns the configuration snapshot', async () => {
      const noopHandle = async (): Promise<void> => {
        /* test stub — handler is never invoked in this case */
      };
      processor.registerHandler('a.event', { handle: noopHandle });
      processor.registerHandler('b.event', { handle: noopHandle });
      processor.use(n => n);

      const stats = await processor.getStats();
      expect(stats.batchSize).toBe(5);
      expect(stats.maxRetries).toBe(3);
      expect(stats.registeredHandlers).toEqual(expect.arrayContaining(['a.event', 'b.event']));
      expect(stats.middlewareCount).toBe(1);
    });
  });

  describe('batch size enforcement', () => {
    it('processes at most batchSize messages per batch', async () => {
      const handler: IOutboxMessageHandler = { handle: vi.fn().mockResolvedValue(undefined) };
      processor.registerHandler('test.event', handler);
      processor.start();

      for (let i = 0; i < 10; i++) {
        await repo.saveMessage(buildMessage({ id: `m-${i}` }));
      }

      await processor.processBatch();
      // batchSize=5, so only 5 should be processed in this run
      expect(handler.handle).toHaveBeenCalledTimes(5);
    });
  });
});
