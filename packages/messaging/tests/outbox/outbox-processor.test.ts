import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  MessagePriority,
  MessageStatus,
  type IOutboxMessage,
  type IOutboxMessageHandler,
} from '../../src/outbox/outbox-interfaces';
import { OutboxProcessor } from '../../src/outbox/outbox-processor';
import { IOutboxRepository } from '../../src/outbox/outbox-repository.interface';
import type { RetryBackoffConfig } from '../../src/outbox/outbox-processor';

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
    ],
    messageTypes?: string[]
  ): Promise<IOutboxMessage[]> {
    const pending = Array.from(this.store.values()).filter(
      m =>
        m.status === MessageStatus.PENDING &&
        (messageTypes === undefined || messageTypes.includes(m.messageType))
    );

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

  override async scheduleRetry(id: string, processAfter: Date): Promise<void> {
    const m = this.store.get(id);
    if (!m) return;
    this.store.set(id, { ...m, status: MessageStatus.PENDING, processAfter });
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

describe('OutboxProcessor — constructor validation', () => {
  let repo: InMemoryOutboxRepository;

  beforeEach(() => {
    repo = new InMemoryOutboxRepository();
  });

  it('throws RangeError when batchSize > 10_000', () => {
    expect(() => new OutboxProcessor(repo, { batchSize: 10_001 })).toThrow(RangeError);
    expect(() => new OutboxProcessor(repo, { batchSize: 10_001 })).toThrow(/batchSize/);
  });

  it('accepts batchSize = 10_000 (boundary)', () => {
    expect(() => new OutboxProcessor(repo, { batchSize: 10_000 })).not.toThrow();
  });

  it('throws RangeError when retryBackoff has non-positive initial', () => {
    expect(
      () =>
        new OutboxProcessor(repo, { retryBackoff: { initial: 0, multiplier: 2, maxDelay: 60_000 } })
    ).toThrow(RangeError);
  });

  it('throws RangeError when retryBackoff has non-positive multiplier', () => {
    expect(
      () =>
        new OutboxProcessor(repo, {
          retryBackoff: { initial: 1000, multiplier: -1, maxDelay: 60_000 },
        })
    ).toThrow(RangeError);
  });

  it('throws RangeError when retryBackoff has non-positive maxDelay', () => {
    expect(
      () =>
        new OutboxProcessor(repo, { retryBackoff: { initial: 1000, multiplier: 2, maxDelay: 0 } })
    ).toThrow(RangeError);
  });

  // D3: a too-small crash-recovery threshold would reset still-in-flight messages.
  it('throws RangeError when crashRecoveryThresholdMs < messageTimeout', () => {
    expect(
      () => new OutboxProcessor(repo, { messageTimeout: 30_000, crashRecoveryThresholdMs: 10_000 })
    ).toThrow(RangeError);
    expect(
      () => new OutboxProcessor(repo, { messageTimeout: 30_000, crashRecoveryThresholdMs: 10_000 })
    ).toThrow(/crashRecoveryThresholdMs/);
  });

  it('throws RangeError when crashRecoveryThresholdMs is 0 (resets everything)', () => {
    expect(() => new OutboxProcessor(repo, { crashRecoveryThresholdMs: 0 })).toThrow(RangeError);
  });

  it('accepts crashRecoveryThresholdMs === messageTimeout (boundary)', () => {
    expect(
      () => new OutboxProcessor(repo, { messageTimeout: 30_000, crashRecoveryThresholdMs: 30_000 })
    ).not.toThrow();
  });

  it('default crashRecoveryThresholdMs satisfies the invariant even for large messageTimeout', () => {
    // messageTimeout (400_000) > the 300_000 floor → default must lift to messageTimeout
    expect(() => new OutboxProcessor(repo, { messageTimeout: 400_000 })).not.toThrow();
  });
});

describe('OutboxProcessor — exponential backoff (retryBackoff option)', () => {
  const BACKOFF: RetryBackoffConfig = { initial: 1000, multiplier: 2, maxDelay: 300_000 };

  let repo: InMemoryOutboxRepository;

  const makeProcessor = (backoff?: RetryBackoffConfig) => {
    const p = new OutboxProcessor(repo, {
      batchSize: 5,
      maxRetries: 3,
      processingInterval: 1000,
      messageTimeout: 5000,
      ...(backoff !== undefined ? { retryBackoff: backoff } : {}),
    });
    p.registerHandler('test.event', {
      handle: async () => {
        throw new Error('always fails');
      },
    });
    p.start();
    return p;
  };

  beforeEach(() => {
    repo = new InMemoryOutboxRepository();
  });

  it('without retryBackoff: resets to PENDING immediately (legacy behavior)', async () => {
    const p = makeProcessor(undefined);
    const id = await repo.saveMessage(buildMessage({ id: 'm-1' }));

    await p.processBatch();

    const stored = repo.store.get(id)!;
    expect(stored.status).toBe(MessageStatus.PENDING);
    expect(stored.processAfter).toBeUndefined();
  });

  it('first failure with retryBackoff: schedules processAfter ≈ initial delay', async () => {
    const before = Date.now();
    const p = makeProcessor(BACKOFF);
    const id = await repo.saveMessage(buildMessage({ id: 'm-1' }));

    await p.processBatch();

    const stored = repo.store.get(id)!;
    expect(stored.status).toBe(MessageStatus.PENDING);
    expect(stored.processAfter).toBeInstanceOf(Date);
    const delay = stored.processAfter!.getTime() - before;
    // delay should be approximately initial (1000ms), allow ±200ms drift
    expect(delay).toBeGreaterThanOrEqual(800);
    expect(delay).toBeLessThanOrEqual(1200);
  });

  it('third failure with retryBackoff: delay = initial × multiplier² (capped at maxDelay)', async () => {
    // Use maxRetries:4 so attempt 3 still gets backoff (not FAILED)
    const p = new OutboxProcessor(repo, {
      batchSize: 5,
      maxRetries: 4,
      processingInterval: 1000,
      messageTimeout: 5000,
      retryBackoff: BACKOFF,
    });
    p.registerHandler('test.event', {
      handle: async () => {
        throw new Error('always fails');
      },
    });
    p.start();

    // 2 prior attempts → after incrementAttempt becomes 3, which is < maxRetries(4)
    const id = await repo.saveMessage(buildMessage({ id: 'm-1', attempts: 2 }));

    const before = Date.now();
    await p.processBatch(); // attempt becomes 3

    const stored = repo.store.get(id)!;
    expect(stored.status).toBe(MessageStatus.PENDING);
    const delay = stored.processAfter!.getTime() - before;
    // expected: 1000 * 2^(3-1) = 4000ms
    expect(delay).toBeGreaterThanOrEqual(3800);
    expect(delay).toBeLessThanOrEqual(4200);
  });

  it('after maxRetries: marks FAILED regardless of backoff config', async () => {
    // Simulate already at maxRetries - 1 = 2 attempts
    const p = makeProcessor(BACKOFF);
    const id = await repo.saveMessage(buildMessage({ id: 'm-1', attempts: 2 }));

    await p.processBatch(); // attempt becomes 3 = maxRetries → FAILED

    const stored = repo.store.get(id)!;
    expect(stored.status).toBe(MessageStatus.FAILED);
    expect(stored.processAfter).toBeUndefined(); // no retry scheduled
  });

  it('respects maxDelay cap — delay never exceeds maxDelay', async () => {
    const tightBackoff: RetryBackoffConfig = { initial: 100_000, multiplier: 10, maxDelay: 5000 };
    const p = makeProcessor(tightBackoff);
    const id = await repo.saveMessage(buildMessage({ id: 'm-1' }));

    const before = Date.now();
    await p.processBatch();

    const stored = repo.store.get(id)!;
    const delay = stored.processAfter!.getTime() - before;
    // raw delay = 100_000 * 10^0 = 100_000ms, but capped at 5000ms
    expect(delay).toBeLessThanOrEqual(5200);
  });

  it('no-op scheduleRetry fallback: message is PENDING, not stuck in PROCESSING', async () => {
    // Use a repository that inherits the default no-op scheduleRetry
    class NoOpRetryRepo extends IOutboxRepository {
      store = new Map<string, IOutboxMessage>();
      async saveMessage<T>(msg: IOutboxMessage<T>): Promise<string> {
        this.store.set(msg.id, msg as IOutboxMessage);
        return msg.id;
      }
      async saveBatch<T>(msgs: IOutboxMessage<T>[]): Promise<string[]> {
        return Promise.all(msgs.map(m => this.saveMessage(m)));
      }
      async getUnprocessedMessages(): Promise<IOutboxMessage[]> {
        return Array.from(this.store.values()).filter(m => m.status === MessageStatus.PENDING);
      }
      async getById(id: string): Promise<IOutboxMessage | null> {
        return this.store.get(id) ?? null;
      }
      async updateStatus(id: string, status: MessageStatus, error?: Error): Promise<void> {
        const m = this.store.get(id);
        if (!m) return;
        this.store.set(id, { ...m, status, ...(error ? { lastError: error.message } : {}) });
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
      async deleteByStatusAndAge(): Promise<number> {
        return 0;
      }
      async scheduleMessage<T>(msg: IOutboxMessage<T>, processAfter: Date): Promise<string> {
        return this.saveMessage({ ...msg, processAfter });
      }
      // scheduleRetry is intentionally NOT overridden — uses no-op default
    }

    const noOpRepo = new NoOpRetryRepo();
    const p = new OutboxProcessor(noOpRepo, {
      batchSize: 5,
      maxRetries: 3,
      processingInterval: 1000,
      messageTimeout: 5000,
      retryBackoff: BACKOFF,
    });
    p.registerHandler('test.event', {
      handle: async () => {
        throw new Error('fails');
      },
    });
    p.start();

    const id = 'msg-noop';
    await noOpRepo.saveMessage(buildMessage({ id }));
    await p.processBatch();

    // Message must be PENDING (not stuck in PROCESSING) even though scheduleRetry was a no-op
    expect(noOpRepo.store.get(id)?.status).toBe(MessageStatus.PENDING);
  });
});

describe('OutboxProcessor — messageTypes filter (Part 2)', () => {
  let repo: InMemoryOutboxRepository;

  beforeEach(() => {
    repo = new InMemoryOutboxRepository();
  });

  it('only fetches and processes messages whose type is in messageTypes', async () => {
    const processor = new OutboxProcessor(repo, { batchSize: 10, messageTypes: ['type.A'] });
    const handlerA = vi.fn().mockResolvedValue(undefined);
    processor.registerHandler('type.A', { handle: handlerA });
    processor.start();

    await repo.saveMessage(buildMessage({ id: 'a-1', messageType: 'type.A' }));
    await repo.saveMessage(buildMessage({ id: 'b-1', messageType: 'type.B' }));

    await processor.processBatch();

    expect(handlerA).toHaveBeenCalledOnce();
    expect(repo.store.get('a-1')?.status).toBe(MessageStatus.PROCESSED);
    // type.B was never fetched → remains untouched
    expect(repo.store.get('b-1')?.status).toBe(MessageStatus.PENDING);
  });

  it('passes the messageTypes allow-list through to getUnprocessedMessages', async () => {
    const spy = vi.spyOn(repo, 'getUnprocessedMessages');
    const processor = new OutboxProcessor(repo, { messageTypes: ['x', 'y'] });
    processor.start();

    await processor.processBatch();

    expect(spy).toHaveBeenCalledWith(expect.any(Number), expect.any(Array), ['x', 'y']);
  });

  it('fetches all types when messageTypes is omitted (backward-compatible)', async () => {
    const spy = vi.spyOn(repo, 'getUnprocessedMessages');
    const processor = new OutboxProcessor(repo, {});
    processor.start();

    await processor.processBatch();

    expect(spy).toHaveBeenCalledWith(expect.any(Number), expect.any(Array), undefined);
  });
});

describe('OutboxProcessor — crash recovery (Part 2 + D3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // processingInterval is set huge so the normal processing timer never fires
  // within the windows we advance — isolating crash-recovery behavior.
  const IDLE_PROCESSING = 1_000_000;

  it('calls resetStaleProcessing every crashRecoveryIntervalMs', async () => {
    const repo = new InMemoryOutboxRepository();
    const spy = vi.spyOn(repo, 'resetStaleProcessing');
    const processor = new OutboxProcessor(repo, {
      processingInterval: IDLE_PROCESSING,
      crashRecoveryIntervalMs: 10_000,
      crashRecoveryThresholdMs: 300_000,
      messageTimeout: 5_000,
    });
    processor.start();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(spy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(spy).toHaveBeenCalledTimes(2);

    processor.stop();
  });

  it('passes olderThan = now - crashRecoveryThresholdMs', async () => {
    const repo = new InMemoryOutboxRepository();
    const spy = vi.spyOn(repo, 'resetStaleProcessing');
    const processor = new OutboxProcessor(repo, {
      processingInterval: IDLE_PROCESSING,
      crashRecoveryIntervalMs: 10_000,
      crashRecoveryThresholdMs: 300_000,
      messageTimeout: 5_000,
    });
    processor.start();

    await vi.advanceTimersByTimeAsync(10_000);

    const olderThan = spy.mock.calls[0]![0];
    expect(olderThan).toBeInstanceOf(Date);
    expect(Date.now() - olderThan.getTime()).toBe(300_000);

    processor.stop();
  });

  it('does not schedule crash recovery when crashRecoveryIntervalMs is omitted', async () => {
    const repo = new InMemoryOutboxRepository();
    const spy = vi.spyOn(repo, 'resetStaleProcessing');
    const processor = new OutboxProcessor(repo, { processingInterval: IDLE_PROCESSING });
    processor.start();

    await vi.advanceTimersByTimeAsync(IDLE_PROCESSING);

    expect(spy).not.toHaveBeenCalled();
    processor.stop();
  });

  it('stop() halts crash-recovery cycles', async () => {
    const repo = new InMemoryOutboxRepository();
    const spy = vi.spyOn(repo, 'resetStaleProcessing');
    const processor = new OutboxProcessor(repo, {
      processingInterval: IDLE_PROCESSING,
      crashRecoveryIntervalMs: 10_000,
    });
    processor.start();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(spy).toHaveBeenCalledTimes(1);

    processor.stop();
    await vi.advanceTimersByTimeAsync(50_000);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('IOutboxRepository.resetStaleProcessing — default (Part 2)', () => {
  it('is a no-op returning 0 when not overridden', async () => {
    const repo = new InMemoryOutboxRepository(); // does not override resetStaleProcessing
    await expect(repo.resetStaleProcessing(new Date())).resolves.toBe(0);
  });
});

describe('OutboxProcessor.processBatch — return value (Part 4)', () => {
  let repo: InMemoryOutboxRepository;

  beforeEach(() => {
    repo = new InMemoryOutboxRepository();
  });

  it('reports processed count and configured batchSize', async () => {
    const processor = new OutboxProcessor(repo, { batchSize: 5 });
    processor.registerHandler('test.event', { handle: vi.fn().mockResolvedValue(undefined) });
    processor.start();

    await repo.saveMessage(buildMessage({ id: 'm-1' }));
    await repo.saveMessage(buildMessage({ id: 'm-2' }));

    const result = await processor.processBatch();
    expect(result).toEqual({ processed: 2, batchSize: 5 });
  });

  it('reports processed 0 when there are no pending messages', async () => {
    const processor = new OutboxProcessor(repo, { batchSize: 5 });
    processor.start();

    const result = await processor.processBatch();
    expect(result).toEqual({ processed: 0, batchSize: 5 });
  });

  it('reports processed 0 when the processor is not running', async () => {
    const processor = new OutboxProcessor(repo, { batchSize: 5 });
    await repo.saveMessage(buildMessage({ id: 'm-1' }));

    const result = await processor.processBatch();
    expect(result).toEqual({ processed: 0, batchSize: 5 });
  });
});

// A repository that always returns a full batch of fresh PENDING messages,
// simulating a perpetually-busy queue — used to exercise adaptive re-poll.
class AlwaysFullRepo extends IOutboxRepository {
  async saveMessage(): Promise<string> {
    return 'noop';
  }
  async saveBatch(): Promise<string[]> {
    return [];
  }
  async getUnprocessedMessages(limit = 10): Promise<IOutboxMessage[]> {
    return Array.from({ length: limit }, (_, i) =>
      buildMessage({ id: `full-${i}`, messageType: 'test.event' })
    );
  }
  async getById(): Promise<IOutboxMessage | null> {
    return null;
  }
  async updateStatus(): Promise<void> {
    /* no-op: messages are regenerated every poll */
  }
  async updateStatusBatch(): Promise<void> {
    /* no-op */
  }
  async incrementAttempt(): Promise<number> {
    return 1;
  }
  async deleteByStatusAndAge(): Promise<number> {
    return 0;
  }
  async scheduleMessage(): Promise<string> {
    return 'noop';
  }
}

describe('OutboxProcessor — adaptive re-poll + startup jitter (Part 4)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const resolvingHandler = (): IOutboxMessageHandler => ({
    handle: vi.fn().mockResolvedValue(undefined),
  });

  it('full batch re-polls immediately, bursting up to the guard then pausing', async () => {
    const repo = new AlwaysFullRepo();
    const spy = vi.spyOn(repo, 'getUnprocessedMessages');
    const processor = new OutboxProcessor(repo, {
      batchSize: 5,
      processingInterval: 10_000,
      adaptiveRepoll: true,
      // defaults: adaptiveRepollMaxConsecutive = 5, adaptiveRepollPauseMs = 50
    });
    processor.registerHandler('test.event', resolvingHandler());
    const t0 = Date.now();
    processor.start();

    // Drive the timer chain, recording the elapsed clock at each poll. Full
    // batches re-poll at the SAME instant (delay 0); the async recursion means
    // a single advance may drain a variable number of same-instant timers, so
    // we loop and collect timestamps until we have enough to assert the shape.
    const pollDeltas: number[] = [];
    for (let i = 0; i < 30 && pollDeltas.length < 8; i++) {
      const before = spy.mock.calls.length;
      await vi.advanceTimersToNextTimerAsync();
      const after = spy.mock.calls.length;
      for (let k = before; k < after; k++) pollDeltas.push(Date.now() - t0);
    }
    processor.stop();

    // The immediate burst: maxConsecutive + 1 = 6 polls, all at the first interval.
    const burst = pollDeltas.filter(d => d === 10_000);
    expect(burst).toHaveLength(6);
    // After the guard trips, cadence throttles to one poll per pauseMs (50ms).
    expect(pollDeltas[6]).toBe(10_050);
    expect(pollDeltas[7]).toBe(10_100);
  });

  it('partial batch falls back to the normal interval (no immediate re-poll)', async () => {
    const repo = new InMemoryOutboxRepository();
    const spy = vi.spyOn(repo, 'getUnprocessedMessages');
    const processor = new OutboxProcessor(repo, {
      batchSize: 5,
      processingInterval: 1_000,
      adaptiveRepoll: true,
    });
    processor.registerHandler('test.event', resolvingHandler());
    processor.start();

    // 2 < batchSize → partial
    await repo.saveMessage(buildMessage({ id: 'p-1' }));
    await repo.saveMessage(buildMessage({ id: 'p-2' }));

    await vi.advanceTimersByTimeAsync(1_000);
    expect(spy).toHaveBeenCalledTimes(1);

    // No immediate re-poll: nothing fires until the next full interval
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(spy).toHaveBeenCalledTimes(2);

    processor.stop();
  });

  it('empty batch uses the normal interval', async () => {
    const repo = new InMemoryOutboxRepository();
    const spy = vi.spyOn(repo, 'getUnprocessedMessages');
    const processor = new OutboxProcessor(repo, {
      batchSize: 5,
      processingInterval: 1_000,
      adaptiveRepoll: true,
    });
    processor.start();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(spy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledTimes(1);

    processor.stop();
  });

  it('adaptiveRepoll disabled (default): full batches still wait the interval', async () => {
    const repo = new AlwaysFullRepo();
    const spy = vi.spyOn(repo, 'getUnprocessedMessages');
    const processor = new OutboxProcessor(repo, {
      batchSize: 5,
      processingInterval: 1_000,
      // adaptiveRepoll omitted → false
    });
    processor.registerHandler('test.event', resolvingHandler());
    processor.start();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(spy).toHaveBeenCalledTimes(1);
    // even though every batch is full, no immediate re-poll
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(spy).toHaveBeenCalledTimes(2);

    processor.stop();
  });

  it('startupJitterMs delays the first poll within the configured window', async () => {
    const repo = new InMemoryOutboxRepository();
    const spy = vi.spyOn(repo, 'getUnprocessedMessages');
    // Force jitter to its max so the first poll lands at processingInterval + 500
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const processor = new OutboxProcessor(repo, {
      processingInterval: 1_000,
      startupJitterMs: 500,
    });
    processor.start();

    // Before interval + jitter elapses, no poll yet
    await vi.advanceTimersByTimeAsync(1_000);
    expect(spy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(spy).toHaveBeenCalledTimes(1);

    processor.stop();
  });
});
