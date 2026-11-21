import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  MessageStatus,
  type IOutboxMessage,
  type IOutboxMessageHandler,
  type OutboxHandlerContext,
} from '../../src/outbox/outbox-interfaces';
import { OutboxProcessor } from '../../src/outbox/outbox-processor';
import {
  IOutboxRepository,
  type ResetStaleProcessingOptions,
} from '../../src/outbox/outbox-repository.interface';
import { OutboxTimeoutError } from '../../src/outbox/outbox-timeout-error';

class MemoryRepo extends IOutboxRepository {
  store = new Map<string, IOutboxMessage>();

  async saveMessage<T>(message: IOutboxMessage<T>): Promise<string> {
    this.store.set(message.id, { ...message } as IOutboxMessage);
    return message.id;
  }
  async saveBatch<T>(messages: IOutboxMessage<T>[]): Promise<string[]> {
    return Promise.all(messages.map(m => this.saveMessage(m)));
  }
  async getUnprocessedMessages(limit = 10): Promise<IOutboxMessage[]> {
    return Array.from(this.store.values())
      .filter(m => m.status === MessageStatus.PENDING)
      .slice(0, limit);
  }
  async getById(id: string): Promise<IOutboxMessage | null> {
    return this.store.get(id) ?? null;
  }
  async updateStatus(id: string, status: MessageStatus): Promise<void> {
    const m = this.store.get(id);
    if (m) this.store.set(id, { ...m, status });
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
  async scheduleMessage<T>(message: IOutboxMessage<T>): Promise<string> {
    return this.saveMessage(message);
  }
}

const message = (overrides: Partial<IOutboxMessage> = {}): IOutboxMessage => ({
  id: 'm-1',
  messageType: 'a.event',
  payload: {},
  metadata: {},
  status: MessageStatus.PENDING,
  attempts: 0,
  createdAt: new Date(),
  ...overrides,
});

const IDLE = 1_000_000;

const newProcessor = (
  repo: IOutboxRepository,
  options: ConstructorParameters<typeof OutboxProcessor>[1] = {}
) =>
  new OutboxProcessor(repo, {
    processingInterval: IDLE,
    maxRetries: 5,
    messageTimeout: 1_000,
    ...options,
  });

/** Handler that never settles — simulates a hung downstream call. */
const never = (): Promise<void> => new Promise<void>(() => undefined);
const hangingHandler = (): IOutboxMessageHandler => ({ handle: never });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('A — handler context', () => {
  it('passes a context with signal, 1-based attempt, deadline and messageId', async () => {
    const repo = new MemoryRepo();
    await repo.saveMessage(message({ attempts: 2 }));
    let seen: OutboxHandlerContext | undefined;
    const processor = newProcessor(repo, { messageTimeout: 1_000 });
    processor.registerHandler('a.event', {
      handle: async (_m, ctx) => {
        seen = ctx;
      },
    });
    processor.start();
    const before = Date.now();

    await processor.processBatch();

    expect(seen?.attempt).toBe(3);
    expect(seen?.messageId).toBe('m-1');
    expect(seen?.deadline.getTime()).toBe(before + 1_000);
    expect(seen?.signal.aborted).toBe(false);
    expect(Object.isFrozen(seen)).toBe(true);
    processor.stop();
  });

  it('does not abort the signal when the handler finishes in time', async () => {
    const repo = new MemoryRepo();
    await repo.saveMessage(message());
    let signal: AbortSignal | undefined;
    const processor = newProcessor(repo);
    processor.registerHandler('a.event', {
      handle: async (_m, ctx) => {
        signal = ctx?.signal;
      },
    });
    processor.start();

    await processor.processBatch();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(signal?.aborted).toBe(false);
    expect(repo.store.get('m-1')?.status).toBe(MessageStatus.PROCESSED);
    processor.stop();
  });

  it('on timeout aborts the signal with an OutboxTimeoutError and records one failed attempt', async () => {
    const repo = new MemoryRepo();
    await repo.saveMessage(message());
    let signal: AbortSignal | undefined;
    const processor = newProcessor(repo, { messageTimeout: 1_000 });
    processor.registerHandler('a.event', {
      handle: (_m, ctx) => {
        signal = ctx?.signal;
        return never();
      },
    });
    processor.start();

    const batch = processor.processBatch();
    await vi.advanceTimersByTimeAsync(1_000);
    await batch;

    expect(signal?.aborted).toBe(true);
    const reason = signal?.reason as OutboxTimeoutError;
    expect(reason).toBeInstanceOf(OutboxTimeoutError);
    expect(reason).toBeInstanceOf(Error);
    expect(reason.message).toBe('Message processing timeout');
    expect(reason).toMatchObject({
      name: 'OutboxTimeoutError',
      messageId: 'm-1',
      messageType: 'a.event',
      timeoutMs: 1_000,
      attempt: 1,
    });
    expect(repo.store.get('m-1')).toMatchObject({ status: MessageStatus.PENDING, attempts: 1 });
    processor.stop();
  });

  it('a handler that honours the signal fails once, not twice', async () => {
    const repo = new MemoryRepo();
    await repo.saveMessage(message());
    const onMessageFailed = vi.fn();
    const processor = newProcessor(repo, { hooks: { onMessageFailed } });
    processor.registerHandler('a.event', {
      handle: (_m, ctx) =>
        new Promise<void>((_, reject) => {
          ctx?.signal.addEventListener('abort', () => reject(ctx.signal.reason));
        }),
    });
    processor.start();

    const batch = processor.processBatch();
    await vi.advanceTimersByTimeAsync(1_000);
    await batch;

    expect(onMessageFailed).toHaveBeenCalledTimes(1);
    expect(onMessageFailed.mock.calls[0]![1]).toBeInstanceOf(OutboxTimeoutError);
    expect(repo.store.get('m-1')?.attempts).toBe(1);
    processor.stop();
  });

  it('a handler that ignores the signal still times out and is retryable', async () => {
    const repo = new MemoryRepo();
    await repo.saveMessage(message());
    const processor = newProcessor(repo);
    processor.registerHandler('a.event', hangingHandler());
    processor.start();

    const batch = processor.processBatch();
    await vi.advanceTimersByTimeAsync(1_000);
    await batch;

    expect(repo.store.get('m-1')?.status).toBe(MessageStatus.PENDING);
    processor.stop();
  });

  it('stop() does NOT abort the signal of an in-flight handler (documented behaviour)', async () => {
    const repo = new MemoryRepo();
    await repo.saveMessage(message());
    let signal: AbortSignal | undefined;
    let release!: () => void;
    const processor = newProcessor(repo, { messageTimeout: 60_000 });
    processor.registerHandler('a.event', {
      handle: (_m, ctx) => {
        signal = ctx?.signal;
        return new Promise<void>(resolve => {
          release = resolve;
        });
      },
    });
    processor.start();

    const batch = processor.processBatch();
    await vi.advanceTimersByTimeAsync(10);
    processor.stop();
    expect(signal?.aborted).toBe(false);

    release();
    await batch;
    expect(repo.store.get('m-1')?.status).toBe(MessageStatus.PROCESSED);
  });

  it('a synchronous throw from handle() is a normal failure and leaves no timer behind', async () => {
    const repo = new MemoryRepo();
    await repo.saveMessage(message());
    const processor = newProcessor(repo);
    processor.registerHandler('a.event', {
      handle: () => {
        throw new Error('boom');
      },
    });
    processor.start();

    await processor.processBatch();

    expect(repo.store.get('m-1')).toMatchObject({ status: MessageStatus.PENDING, attempts: 1 });
    expect(vi.getTimerCount()).toBe(1); // only the processing-interval timer
    processor.stop();
  });
});

describe('B — per-type timeout', () => {
  it('applies messageTimeoutMs only to the type it was registered for', async () => {
    const repo = new MemoryRepo();
    await repo.saveMessage(message({ id: 'fast', messageType: 'fast.event' }));
    await repo.saveMessage(message({ id: 'slow', messageType: 'slow.event' }));
    const processor = newProcessor(repo, { messageTimeout: 10_000 });
    processor.registerHandler('fast.event', hangingHandler(), { messageTimeoutMs: 100 });
    processor.registerHandler('slow.event', {
      handle: () => new Promise<void>(resolve => setTimeout(resolve, 500)),
    });
    processor.start();

    const batch = processor.processBatch();
    await vi.advanceTimersByTimeAsync(500);
    await batch;

    expect(repo.store.get('fast')).toMatchObject({ status: MessageStatus.PENDING, attempts: 1 });
    expect(repo.store.get('slow')?.status).toBe(MessageStatus.PROCESSED);
    processor.stop();
  });

  it('exposes the per-type deadline through the context', async () => {
    const repo = new MemoryRepo();
    await repo.saveMessage(message());
    let deadline: Date | undefined;
    const processor = newProcessor(repo, { messageTimeout: 10_000 });
    processor.registerHandler(
      'a.event',
      {
        handle: async (_m, ctx) => {
          deadline = ctx?.deadline;
        },
      },
      { messageTimeoutMs: 250 }
    );
    processor.start();
    const before = Date.now();

    await processor.processBatch();

    expect(deadline?.getTime()).toBe(before + 250);
    processor.stop();
  });

  it('applies the option to the default handler', async () => {
    const repo = new MemoryRepo();
    await repo.saveMessage(message({ messageType: 'unmapped.event' }));
    const processor = newProcessor(repo, { messageTimeout: 10_000 });
    processor.registerDefaultHandler(hangingHandler(), { messageTimeoutMs: 100 });
    processor.start();

    const batch = processor.processBatch();
    await vi.advanceTimersByTimeAsync(100);
    await batch;

    expect(repo.store.get('m-1')?.attempts).toBe(1);
    processor.stop();
  });

  it('re-registering without the option reverts to the processor default', async () => {
    const repo = new MemoryRepo();
    await repo.saveMessage(message());
    const processor = newProcessor(repo, { messageTimeout: 1_000 });
    processor.registerHandler('a.event', hangingHandler(), { messageTimeoutMs: 100 });
    processor.registerHandler('a.event', {
      handle: () => new Promise<void>(resolve => setTimeout(resolve, 500)),
    });
    processor.start();

    const batch = processor.processBatch();
    await vi.advanceTimersByTimeAsync(500);
    await batch;

    expect(repo.store.get('m-1')?.status).toBe(MessageStatus.PROCESSED);
    processor.stop();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])(
    'rejects an invalid messageTimeoutMs (%s) without registering the handler',
    value => {
      const processor = newProcessor(new MemoryRepo());
      expect(() =>
        processor.registerHandler('a.event', hangingHandler(), { messageTimeoutMs: value })
      ).toThrow(RangeError);
      expect(processor.getStats()).resolves.toMatchObject({ registeredHandlers: [] });
    }
  );

  it('rejects a messageTimeoutMs above an explicit crashRecoveryThresholdMs', () => {
    const processor = newProcessor(new MemoryRepo(), {
      messageTimeout: 1_000,
      crashRecoveryThresholdMs: 5_000,
    });
    expect(() =>
      processor.registerHandler('a.event', hangingHandler(), { messageTimeoutMs: 5_001 })
    ).toThrow(/crashRecoveryThresholdMs \(5000\) must be ≥ messageTimeoutMs \(5001\)/);
    expect(() =>
      processor.registerHandler('a.event', hangingHandler(), { messageTimeoutMs: 5_000 })
    ).not.toThrow();
  });

  it('derives the default recovery threshold from the largest per-type timeout', async () => {
    const repo = new MemoryRepo();
    const spy = vi.spyOn(repo, 'resetStaleProcessing');
    const processor = newProcessor(repo, {
      messageTimeout: 1_000,
      crashRecoveryIntervalMs: 10_000,
    });
    processor.registerHandler('a.event', hangingHandler(), { messageTimeoutMs: 600_000 });
    processor.start();

    await vi.advanceTimersByTimeAsync(10_000);

    const olderThan = spy.mock.calls[0]![0];
    expect(Date.now() - olderThan.getTime()).toBe(600_000);
    processor.stop();
  });

  it('keeps the existing default threshold when no per-type timeout is registered', async () => {
    const repo = new MemoryRepo();
    const spy = vi.spyOn(repo, 'resetStaleProcessing');
    const processor = newProcessor(repo, { crashRecoveryIntervalMs: 10_000 });
    processor.start();

    await vi.advanceTimersByTimeAsync(10_000);

    expect(Date.now() - spy.mock.calls[0]![0].getTime()).toBe(300_000);
    processor.stop();
  });
});

describe('D — resetStaleProcessing options', () => {
  it('passes maxRetries and a copy of the messageTypes allow-list', async () => {
    const repo = new MemoryRepo();
    const spy = vi.spyOn(repo, 'resetStaleProcessing');
    const types = ['a.event', 'b.event'];
    const processor = newProcessor(repo, {
      maxRetries: 7,
      messageTypes: types,
      crashRecoveryIntervalMs: 10_000,
    });
    processor.start();

    await vi.advanceTimersByTimeAsync(10_000);

    const options = spy.mock.calls[0]![1] as ResetStaleProcessingOptions;
    expect(options).toEqual({ maxRetries: 7, messageTypes: ['a.event', 'b.event'] });
    expect(options.messageTypes).not.toBe(types);
    processor.stop();
  });

  it('omits messageTypes when the processor has no allow-list', async () => {
    const repo = new MemoryRepo();
    const spy = vi.spyOn(repo, 'resetStaleProcessing');
    const processor = newProcessor(repo, { maxRetries: 4, crashRecoveryIntervalMs: 10_000 });
    processor.start();

    await vi.advanceTimersByTimeAsync(10_000);

    expect(spy.mock.calls[0]![1]).toEqual({ maxRetries: 4 });
    processor.stop();
  });

  it('keeps working with a repository that overrides resetStaleProcessing with one parameter', async () => {
    class LegacyRepo extends MemoryRepo {
      calls = 0;
      override async resetStaleProcessing(_olderThan: Date): Promise<number> {
        this.calls++;
        return 0;
      }
    }
    const repo = new LegacyRepo();
    const processor = newProcessor(repo, { crashRecoveryIntervalMs: 10_000 });
    processor.start();

    await vi.advanceTimersByTimeAsync(10_000);

    expect(repo.calls).toBe(1);
    processor.stop();
  });

  it('the default shim still resolves 0 and ignores options', async () => {
    await expect(
      new MemoryRepo().resetStaleProcessing(new Date(), { maxRetries: 3, messageTypes: ['x'] })
    ).resolves.toBe(0);
  });

  it('crash recovery itself never touches attempts (documented contract)', async () => {
    const repo = new MemoryRepo();
    const increment = vi.spyOn(repo, 'incrementAttempt');
    const processor = newProcessor(repo, { crashRecoveryIntervalMs: 10_000 });
    processor.start();

    await vi.advanceTimersByTimeAsync(30_000);

    expect(increment).not.toHaveBeenCalled();
    processor.stop();
  });
});

describe('E — timeout diagnostics hooks', () => {
  it('fires onHandlerTimeout with the effective timeout and attempt, before onMessageFailed', async () => {
    const repo = new MemoryRepo();
    await repo.saveMessage(message({ attempts: 1 }));
    const order: string[] = [];
    const onHandlerTimeout = vi.fn(() => order.push('timeout'));
    const onMessageFailed = vi.fn(() => order.push('failed'));
    const processor = newProcessor(repo, { hooks: { onHandlerTimeout, onMessageFailed } });
    processor.registerHandler('a.event', hangingHandler(), { messageTimeoutMs: 300 });
    processor.start();

    const batch = processor.processBatch();
    await vi.advanceTimersByTimeAsync(300);
    await batch;

    expect(onHandlerTimeout).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-1' }), {
      timeoutMs: 300,
      attempt: 2,
    });
    expect(order).toEqual(['timeout', 'failed']);
    processor.stop();
  });

  it("fires onLateSettle('resolved', lateMs) when a timed-out handler later succeeds", async () => {
    const repo = new MemoryRepo();
    await repo.saveMessage(message());
    const onLateSettle = vi.fn();
    const processor = newProcessor(repo, { messageTimeout: 1_000, hooks: { onLateSettle } });
    processor.registerHandler('a.event', {
      handle: () => new Promise<void>(resolve => setTimeout(resolve, 1_700)),
    });
    processor.start();

    const batch = processor.processBatch();
    await vi.advanceTimersByTimeAsync(1_000);
    await batch;
    expect(onLateSettle).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(700);

    expect(onLateSettle).toHaveBeenCalledTimes(1);
    expect(onLateSettle).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm-1' }),
      'resolved',
      700
    );
    // The late result never touches the stored status (it was already reset to PENDING).
    expect(repo.store.get('m-1')?.status).toBe(MessageStatus.PENDING);
    processor.stop();
  });

  it("fires onLateSettle('rejected', lateMs) when a timed-out handler later fails", async () => {
    const repo = new MemoryRepo();
    await repo.saveMessage(message());
    const onLateSettle = vi.fn();
    const processor = newProcessor(repo, { messageTimeout: 1_000, hooks: { onLateSettle } });
    processor.registerHandler('a.event', {
      handle: () =>
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('late')), 1_200)),
    });
    processor.start();

    const batch = processor.processBatch();
    await vi.advanceTimersByTimeAsync(1_200);
    await batch;

    expect(onLateSettle).toHaveBeenCalledWith(expect.anything(), 'rejected', 200);
    processor.stop();
  });

  it('does not fire either hook for handlers that finish in time', async () => {
    const repo = new MemoryRepo();
    await repo.saveMessage(message());
    const onHandlerTimeout = vi.fn();
    const onLateSettle = vi.fn();
    const processor = newProcessor(repo, { hooks: { onHandlerTimeout, onLateSettle } });
    processor.registerHandler('a.event', { handle: () => Promise.resolve() });
    processor.start();

    await processor.processBatch();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(onHandlerTimeout).not.toHaveBeenCalled();
    expect(onLateSettle).not.toHaveBeenCalled();
    processor.stop();
  });

  it('a throwing hook neither breaks the batch nor swallows the timeout failure', async () => {
    const repo = new MemoryRepo();
    await repo.saveMessage(message());
    const processor = newProcessor(repo, {
      hooks: {
        onHandlerTimeout: () => {
          throw new Error('hook bug');
        },
        onLateSettle: () => {
          throw new Error('hook bug');
        },
      },
    });
    processor.registerHandler('a.event', {
      handle: () => new Promise<void>(resolve => setTimeout(resolve, 1_500)),
    });
    processor.start();

    const batch = processor.processBatch();
    await vi.advanceTimersByTimeAsync(1_500);
    await batch;

    expect(repo.store.get('m-1')).toMatchObject({ status: MessageStatus.PENDING, attempts: 1 });
    processor.stop();
  });
});
