/* eslint-disable @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { internalLogger } from '@vytches/ddd-contracts/internal';

import {
  MessagePriority,
  MessageStatus,
  type IOutboxMessage,
  type IOutboxMessageHandler,
} from '../../src/outbox/outbox-interfaces';
import { OutboxProcessor } from '../../src/outbox/outbox-processor';
import type { OutboxProcessorOptions } from '../../src/outbox/outbox-processor';
import {
  IOutboxRepository,
  type OutboxFencedReleaseOutcome,
} from '../../src/outbox/outbox-repository.interface';

/** Reference in-memory repository: every fenced write applies only while the claim is held. */
class FencedMemoryRepo extends IOutboxRepository {
  store = new Map<string, IOutboxMessage>();
  private tokenSeq = 0;
  /** Test seam: runs right after `recordFailureFenced` applied, before the release. */
  afterRecordFailure?: (id: string) => void;

  async saveMessage<T>(message: IOutboxMessage<T>): Promise<string> {
    this.store.set(message.id, { ...message } as IOutboxMessage);
    return message.id;
  }
  async saveBatch<T>(messages: IOutboxMessage<T>[]): Promise<string[]> {
    return Promise.all(messages.map(m => this.saveMessage(m)));
  }
  async getUnprocessedMessages(limit = 10): Promise<IOutboxMessage[]> {
    return [...this.store.values()].filter(m => m.status === MessageStatus.PENDING).slice(0, limit);
  }
  override async claimBatch(limit = 10): Promise<IOutboxMessage[]> {
    const claimed = (await this.getUnprocessedMessages(limit)).map(m => ({
      ...m,
      status: MessageStatus.PROCESSING,
      claimToken: `tok-${++this.tokenSeq}`,
    }));
    for (const m of claimed) this.store.set(m.id, m);
    return claimed;
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
    this.store.set(id, { ...m, attempts: m.attempts + 1 });
    return m.attempts + 1;
  }
  async deleteByStatusAndAge(): Promise<number> {
    return 0;
  }
  async scheduleMessage<T>(message: IOutboxMessage<T>): Promise<string> {
    return this.saveMessage(message);
  }

  /** What crash recovery does to a row: back to PENDING with the token cleared, then re-claimed. */
  forceReclaim(id: string): string {
    const m = this.store.get(id)!;
    const claimToken = `tok-${++this.tokenSeq}`;
    this.store.set(id, { ...m, status: MessageStatus.PROCESSING, claimToken });
    return claimToken;
  }

  private holds(id: string, token: string): IOutboxMessage | undefined {
    const m = this.store.get(id);
    return m && m.status === MessageStatus.PROCESSING && m.claimToken === token ? m : undefined;
  }

  override async completeFenced(id: string, token: string): Promise<boolean> {
    const m = this.holds(id, token);
    if (!m) return false;
    const { claimToken: _cleared, ...rest } = m;
    this.store.set(id, { ...rest, status: MessageStatus.PROCESSED });
    return true;
  }
  override async recordFailureFenced(
    id: string,
    token: string,
    error: Error
  ): Promise<number | null> {
    const m = this.holds(id, token);
    if (!m) return null;
    this.store.set(id, { ...m, attempts: m.attempts + 1, lastError: error.message });
    this.afterRecordFailure?.(id);
    return m.attempts + 1;
  }
  override async releaseFenced(
    id: string,
    token: string,
    outcome: OutboxFencedReleaseOutcome
  ): Promise<boolean> {
    const m = this.holds(id, token);
    if (!m) return false;
    const { claimToken: _cleared, ...rest } = m;
    this.store.set(id, {
      ...rest,
      status: outcome.status,
      ...(outcome.processAfter ? { processAfter: outcome.processAfter } : {}),
      ...(outcome.error ? { lastError: outcome.error.message } : {}),
    });
    return true;
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
const make = (repo: IOutboxRepository, options: OutboxProcessorOptions = {}) =>
  new OutboxProcessor(repo, {
    processingInterval: IDLE,
    maxRetries: 3,
    messageTimeout: 1_000,
    useFencing: true,
    ...options,
  });
const ok: IOutboxMessageHandler = { handle: () => Promise.resolve() };
const failing = (): IOutboxMessageHandler => ({
  handle: () => Promise.reject(new Error('handler failed')),
});

let processor: OutboxProcessor | undefined;
afterEach(() => {
  processor?.stop();
  processor = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useFencing — construction', () => {
  it('throws TypeError naming the missing fenced methods', () => {
    class Bare extends FencedMemoryRepo {}
    const bare = new Bare();
    // @ts-expect-error simulate a repository that only implements the legacy contract
    bare.releaseFenced = undefined;
    // @ts-expect-error simulate a repository that only implements the legacy contract
    bare.completeFenced = undefined;
    expect(() => make(bare)).toThrow(TypeError);
    expect(() => make(bare)).toThrow(/completeFenced, releaseFenced/);
  });

  it('throws for a legacy repository that implements none of them', () => {
    class Legacy extends IOutboxRepository {
      async saveMessage() {
        return '';
      }
      async saveBatch() {
        return [];
      }
      async getUnprocessedMessages() {
        return [];
      }
      async getById() {
        return null;
      }
      async updateStatus() {}
      async updateStatusBatch() {}
      async incrementAttempt() {
        return 0;
      }
      async deleteByStatusAndAge() {
        return 0;
      }
      async scheduleMessage() {
        return '';
      }
    }
    expect(() => make(new Legacy())).toThrow(/completeFenced, recordFailureFenced, releaseFenced/);
    expect(() => make(new Legacy(), { useFencing: false })).not.toThrow();
  });
});

describe('useFencing — outcomes', () => {
  let repo: FencedMemoryRepo;
  beforeEach(async () => {
    repo = new FencedMemoryRepo();
    await repo.saveMessage(message());
  });

  it('claims via claimBatch and completes with the claim token (no legacy status writes)', async () => {
    const claim = vi.spyOn(repo, 'claimBatch');
    const complete = vi.spyOn(repo, 'completeFenced');
    const legacy = vi.spyOn(repo, 'updateStatus');
    processor = make(repo);
    processor.registerHandler('a.event', ok);
    processor.start();

    await processor.processBatch();

    expect(claim).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledWith('m-1', 'tok-1');
    expect(legacy).not.toHaveBeenCalled();
    expect(repo.store.get('m-1')).toMatchObject({ status: MessageStatus.PROCESSED });
    expect(repo.store.get('m-1')?.claimToken).toBeUndefined();
  });

  it('a failure is one fenced attempt increment + one fenced release (no legacy writes)', async () => {
    const onMessageFailed = vi.fn();
    const record = vi.spyOn(repo, 'recordFailureFenced');
    const release = vi.spyOn(repo, 'releaseFenced');
    const legacy = [
      vi.spyOn(repo, 'updateStatus'),
      vi.spyOn(repo, 'incrementAttempt'),
      vi.spyOn(repo, 'scheduleRetry'),
    ];
    processor = make(repo, { hooks: { onMessageFailed } });
    processor.registerHandler('a.event', failing());
    processor.start();

    await processor.processBatch();

    expect(record).toHaveBeenCalledWith('m-1', 'tok-1', expect.any(Error));
    expect(release).toHaveBeenCalledWith('m-1', 'tok-1', {
      status: MessageStatus.PENDING,
      error: expect.any(Error),
    });
    legacy.forEach(spy => expect(spy).not.toHaveBeenCalled());
    expect(onMessageFailed).toHaveBeenCalledWith(expect.anything(), expect.any(Error), 1);
    expect(repo.store.get('m-1')).toMatchObject({ status: MessageStatus.PENDING, attempts: 1 });
  });

  it('with retryBackoff the delay is set in the SAME release (no PENDING-before-delay window)', async () => {
    vi.useFakeTimers();
    const release = vi.spyOn(repo, 'releaseFenced');
    const scheduleRetry = vi.spyOn(repo, 'scheduleRetry');
    processor = make(repo, { retryBackoff: { initial: 1_000, multiplier: 2, maxDelay: 60_000 } });
    processor.registerHandler('a.event', failing());
    processor.start();

    await processor.processBatch();

    expect(release).toHaveBeenCalledOnce();
    expect(release.mock.calls[0]![2].processAfter?.getTime()).toBe(Date.now() + 1_000);
    expect(scheduleRetry).not.toHaveBeenCalled();
  });

  it('releases to FAILED and fires onPermanentFailure once the budget is exhausted', async () => {
    await repo.saveMessage(message({ id: 'm-1', attempts: 2 }));
    const onPermanentFailure = vi.fn();
    const release = vi.spyOn(repo, 'releaseFenced');
    processor = make(repo, {
      maxRetries: 3,
      retryBackoff: { initial: 1_000, multiplier: 2, maxDelay: 60_000 },
      hooks: { onPermanentFailure },
    });
    processor.registerHandler('a.event', failing());
    processor.start();

    await processor.processBatch();

    expect(release.mock.calls[0]![2]).toEqual({
      status: MessageStatus.FAILED,
      error: expect.any(Error),
    });
    expect(onPermanentFailure).toHaveBeenCalledOnce();
    expect(repo.store.get('m-1')).toMatchObject({ status: MessageStatus.FAILED, attempts: 3 });
  });

  it('a timeout is recorded fenced and the message becomes claimable again with a NEW token', async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const runs: string[] = [];
    processor = make(repo, { messageTimeout: 1_000 });
    processor.registerHandler('a.event', {
      handle: (_m, ctx) => {
        runs.push(`run-${ctx?.attempt}`);
        return runs.length === 1
          ? new Promise<void>(resolve => {
              release = resolve;
            })
          : Promise.resolve();
      },
    });
    processor.start();

    const first = processor.processBatch();
    await vi.advanceTimersByTimeAsync(1_000);
    await first;
    expect(repo.store.get('m-1')).toMatchObject({ status: MessageStatus.PENDING, attempts: 1 });

    await processor.processBatch(); // retry while the first handler is still hung
    release(); // the zombie finishes late — it must not write anything
    await vi.advanceTimersByTimeAsync(10);

    expect(runs).toEqual(['run-1', 'run-2']);
    expect(repo.store.get('m-1')).toMatchObject({ status: MessageStatus.PROCESSED, attempts: 1 });
  });
});

describe('useFencing — stale writes (the point of the feature)', () => {
  let repo: FencedMemoryRepo;
  beforeEach(async () => {
    repo = new FencedMemoryRepo();
    await repo.saveMessage(message());
  });

  it('uses the claim-time token, so a late success cannot complete a re-claimed row (ABA: status is PROCESSING again)', async () => {
    const onStaleWrite = vi.fn();
    const onMessageFailed = vi.fn();
    processor = make(repo, { hooks: { onStaleWrite, onMessageFailed } });
    let newerToken = '';
    processor.registerHandler('a.event', {
      handle: async () => {
        newerToken = repo.forceReclaim('m-1'); // recovery reset + a second worker claimed it
      },
    });
    processor.start();

    await processor.processBatch();

    expect(onStaleWrite).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-1' }), 'complete');
    expect(onMessageFailed).not.toHaveBeenCalled();
    expect(repo.store.get('m-1')).toMatchObject({
      status: MessageStatus.PROCESSING,
      claimToken: newerToken,
      attempts: 0,
    });
  });

  it('a late failure neither burns an attempt nor fires failure hooks', async () => {
    const onStaleWrite = vi.fn();
    const onMessageFailed = vi.fn();
    const onPermanentFailure = vi.fn();
    const release = vi.spyOn(repo, 'releaseFenced');
    processor = make(repo, { hooks: { onStaleWrite, onMessageFailed, onPermanentFailure } });
    processor.registerHandler('a.event', {
      handle: async () => {
        repo.forceReclaim('m-1');
        throw new Error('late failure');
      },
    });
    processor.start();

    await processor.processBatch();

    expect(onStaleWrite).toHaveBeenCalledWith(expect.anything(), 'recordFailure');
    expect(onMessageFailed).not.toHaveBeenCalled();
    expect(onPermanentFailure).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    expect(repo.store.get('m-1')).toMatchObject({ status: MessageStatus.PROCESSING, attempts: 0 });
  });

  it('losing the claim between the failure record and the release discards the release', async () => {
    await repo.saveMessage(message({ id: 'm-1', attempts: 2 }));
    const onStaleWrite = vi.fn();
    const onPermanentFailure = vi.fn();
    repo.afterRecordFailure = id => {
      repo.forceReclaim(id);
    };
    processor = make(repo, { maxRetries: 3, hooks: { onStaleWrite, onPermanentFailure } });
    processor.registerHandler('a.event', failing());
    processor.start();

    await processor.processBatch();

    expect(onStaleWrite).toHaveBeenCalledWith(expect.anything(), 'release');
    expect(onPermanentFailure).not.toHaveBeenCalled(); // not marked FAILED — the newer claim owns it
    expect(repo.store.get('m-1')?.status).toBe(MessageStatus.PROCESSING);
  });

  it('a throwing onStaleWrite hook does not break the batch', async () => {
    processor = make(repo, {
      hooks: {
        onStaleWrite: () => {
          throw new Error('hook bug');
        },
      },
    });
    processor.registerHandler('a.event', {
      handle: async () => {
        repo.forceReclaim('m-1');
      },
    });
    processor.start();

    await expect(processor.processBatch()).resolves.toMatchObject({ processed: 1 });
  });
});

describe('useFencing — contract violations and write failures', () => {
  it('skips (and logs) a claimed message that has no claimToken; it is not dispatched', async () => {
    class NoTokenRepo extends FencedMemoryRepo {
      override async claimBatch(limit = 10): Promise<IOutboxMessage[]> {
        const pending = await this.getUnprocessedMessages(limit);
        for (const m of pending) this.store.set(m.id, { ...m, status: MessageStatus.PROCESSING });
        return pending.map(m => ({ ...m, status: MessageStatus.PROCESSING }));
      }
    }
    const repo = new NoTokenRepo();
    await repo.saveMessage(message());
    const error = vi.spyOn(internalLogger, 'error').mockImplementation(() => undefined);
    const handle = vi.fn().mockResolvedValue(undefined);
    processor = make(repo);
    processor.registerHandler('a.event', { handle });
    processor.start();

    await expect(processor.processBatch()).resolves.toMatchObject({ processed: 0 });

    expect(handle).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('without claimToken'), undefined, {
      skipped: 1,
      firstMessageId: 'm-1',
    });
    expect(repo.store.get('m-1')?.status).toBe(MessageStatus.PROCESSING);
  });

  it('a failing completion write is not a handler failure: no attempt, no failure hook, released', async () => {
    const repo = new FencedMemoryRepo();
    await repo.saveMessage(message());
    vi.spyOn(internalLogger, 'error').mockImplementation(() => undefined);
    vi.spyOn(repo, 'completeFenced').mockRejectedValue(new Error('db down'));
    const record = vi.spyOn(repo, 'recordFailureFenced');
    const onMessageFailed = vi.fn();
    processor = make(repo, { hooks: { onMessageFailed } });
    processor.registerHandler('a.event', ok);
    processor.start();

    await processor.processBatch();

    expect(record).not.toHaveBeenCalled();
    expect(onMessageFailed).not.toHaveBeenCalled();
    expect(repo.store.get('m-1')).toMatchObject({ status: MessageStatus.PENDING, attempts: 0 });
  });
});

describe('opt-in isolateCompletionWriteFailures (unfenced) — a failing PROCESSED write is not a handler failure', () => {
  class LegacyRepo extends FencedMemoryRepo {
    failProcessedWrites = true;
    failReleaseWrites = false;
    /** The PROCESSED write commits, but the client still sees an error (lost ack). */
    commitThenFail = false;
    override async updateStatus(id: string, status: MessageStatus): Promise<void> {
      if (status === MessageStatus.PROCESSED && this.commitThenFail) {
        await super.updateStatus(id, status);
        throw new Error('lost ack');
      }
      if (status === MessageStatus.PROCESSED && this.failProcessedWrites)
        throw new Error('db down');
      if (status === MessageStatus.PENDING && this.failReleaseWrites) throw new Error('db down');
      return super.updateStatus(id, status);
    }
  }

  it('redelivers a bounded number of times without consuming attempts, then leaves it PROCESSING', async () => {
    const repo = new LegacyRepo();
    await repo.saveMessage(message());
    vi.spyOn(internalLogger, 'error').mockImplementation(() => undefined);
    const incrementAttempt = vi.spyOn(repo, 'incrementAttempt');
    const onMessageFailed = vi.fn();
    const onPermanentFailure = vi.fn();
    const onCompletionWriteFailed = vi.fn();
    const handle = vi.fn().mockResolvedValue(undefined);
    processor = make(repo, {
      useFencing: false,
      isolateCompletionWriteFailures: true,
      maxRetries: 2,
      hooks: { onMessageFailed, onPermanentFailure, onCompletionWriteFailed },
    });
    processor.registerHandler('a.event', { handle });
    processor.start();

    for (let i = 0; i < 6; i++) await processor.processBatch();

    expect(handle).toHaveBeenCalledTimes(3); // first delivery + maxRetries redeliveries, then it stops
    expect(incrementAttempt).not.toHaveBeenCalled();
    expect(onMessageFailed).not.toHaveBeenCalled();
    expect(onPermanentFailure).not.toHaveBeenCalled();
    expect(onCompletionWriteFailed.mock.calls.map(c => c[2])).toEqual([
      { consecutiveFailures: 1, released: true },
      { consecutiveFailures: 2, released: true },
      { consecutiveFailures: 3, released: false },
    ]);
    expect(repo.store.get('m-1')).toMatchObject({ status: MessageStatus.PROCESSING, attempts: 0 });
  });

  it('does not undo a PROCESSED write that committed before the error surfaced (read-back)', async () => {
    const repo = new LegacyRepo();
    repo.commitThenFail = true;
    await repo.saveMessage(message());
    vi.spyOn(internalLogger, 'error').mockImplementation(() => undefined);
    const updateStatus = vi.spyOn(repo, 'updateStatus');
    const onCompletionWriteFailed = vi.fn();
    const onBatchComplete = vi.fn();
    processor = make(repo, {
      useFencing: false,
      isolateCompletionWriteFailures: true,
      hooks: { onCompletionWriteFailed, onBatchComplete },
    });
    processor.registerHandler('a.event', ok);
    processor.start();

    await processor.processBatch();

    expect(updateStatus).not.toHaveBeenCalledWith('m-1', MessageStatus.PENDING);
    expect(repo.store.get('m-1')?.status).toBe(MessageStatus.PROCESSED);
    expect(onBatchComplete).toHaveBeenCalledWith(expect.objectContaining({ failed: 0 }));
    expect(onCompletionWriteFailed).not.toHaveBeenCalled();
  });

  it('still releases when the read-back itself fails', async () => {
    const repo = new LegacyRepo();
    await repo.saveMessage(message());
    vi.spyOn(internalLogger, 'error').mockImplementation(() => undefined);
    vi.spyOn(internalLogger, 'warn').mockImplementation(() => undefined);
    vi.spyOn(repo, 'getById').mockRejectedValue(new Error('read failed'));
    processor = make(repo, { useFencing: false, isolateCompletionWriteFailures: true });
    processor.registerHandler('a.event', ok);
    processor.start();

    await processor.processBatch();

    expect(repo.store.get('m-1')?.status).toBe(MessageStatus.PENDING);
  });

  it('leaves the message PROCESSING for crash recovery when the release fails too, without throwing', async () => {
    const repo = new LegacyRepo();
    repo.failReleaseWrites = true;
    await repo.saveMessage(message());
    vi.spyOn(internalLogger, 'error').mockImplementation(() => undefined);
    processor = make(repo, { useFencing: false, isolateCompletionWriteFailures: true });
    processor.registerHandler('a.event', ok);
    processor.start();

    await expect(processor.processBatch()).resolves.toMatchObject({ processed: 1 });

    expect(repo.store.get('m-1')?.status).toBe(MessageStatus.PROCESSING);
  });
});

describe('useFencing — claimBatch contract', () => {
  it('throws when the repository inherits the default claimBatch shim (it sets no token)', () => {
    class NoClaimOverride extends IOutboxRepository {
      async saveMessage() {
        return '';
      }
      async saveBatch() {
        return [];
      }
      async getUnprocessedMessages() {
        return [];
      }
      async getById() {
        return null;
      }
      async updateStatus() {}
      async updateStatusBatch() {}
      async incrementAttempt() {
        return 0;
      }
      async deleteByStatusAndAge() {
        return 0;
      }
      async scheduleMessage() {
        return '';
      }
      override async completeFenced() {
        return true;
      }
      override async recordFailureFenced() {
        return 1;
      }
      override async releaseFenced() {
        return true;
      }
    }
    expect(() => make(new NoClaimOverride())).toThrow(/override claimBatch\(\)/);
  });

  it('forwards batchSize, priorityOrder and messageTypes to claimBatch', async () => {
    const repo = new FencedMemoryRepo();
    const claim = vi.spyOn(repo, 'claimBatch');
    const priorityOrder = [MessagePriority.LOW, MessagePriority.HIGH];
    processor = make(repo, { batchSize: 7, priorityOrder, messageTypes: ['a.event'] });
    processor.start();

    await processor.processBatch();

    expect(claim).toHaveBeenCalledWith(7, priorityOrder, ['a.event']);
  });

  it('processes only the tokened messages of a mixed batch', async () => {
    class MixedRepo extends FencedMemoryRepo {
      override async claimBatch(limit = 10): Promise<IOutboxMessage[]> {
        const claimed = await super.claimBatch(limit);
        return claimed.map(m => {
          if (m.id !== 'm-2') return m;
          const { claimToken: _token, ...tokenless } = m;
          return tokenless;
        });
      }
    }
    const repo = new MixedRepo();
    await repo.saveMessage(message({ id: 'm-1' }));
    await repo.saveMessage(message({ id: 'm-2' }));
    vi.spyOn(internalLogger, 'error').mockImplementation(() => undefined);
    const handle = vi.fn().mockResolvedValue(undefined);
    processor = make(repo);
    processor.registerHandler('a.event', { handle });
    processor.start();

    await expect(processor.processBatch()).resolves.toMatchObject({ processed: 1 });

    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle.mock.calls[0]![0]).toMatchObject({ id: 'm-1' });
    expect(repo.store.get('m-1')?.status).toBe(MessageStatus.PROCESSED);
    expect(repo.store.get('m-2')?.status).toBe(MessageStatus.PROCESSING);
  });

  it('never exposes the claim token to handlers or hooks', async () => {
    const repo = new FencedMemoryRepo();
    await repo.saveMessage(message());
    const seen: IOutboxMessage[] = [];
    const complete = vi.spyOn(repo, 'completeFenced');
    processor = make(repo, {
      hooks: { onMessageFailed: m => seen.push(m), onBatchComplete: () => undefined },
    });
    let handled: IOutboxMessage | undefined;
    processor.registerHandler('a.event', {
      handle: async m => {
        handled = m;
      },
    });
    processor.start();

    await processor.processBatch();

    expect(handled).toBeDefined();
    expect('claimToken' in handled!).toBe(false);
    expect(complete).toHaveBeenCalledWith('m-1', 'tok-1'); // the processor itself still uses it
    expect(seen).toEqual([]);
  });

  it('hooks receive the message without the claim token on failure too', async () => {
    const repo = new FencedMemoryRepo();
    await repo.saveMessage(message());
    const onMessageFailed = vi.fn();
    processor = make(repo, { hooks: { onMessageFailed } });
    processor.registerHandler('a.event', failing());
    processor.start();

    await processor.processBatch();

    expect('claimToken' in onMessageFailed.mock.calls[0]![0]).toBe(false);
  });
});

describe('useFencing — completion write failures', () => {
  let repo: FencedMemoryRepo;
  beforeEach(async () => {
    repo = new FencedMemoryRepo();
    await repo.saveMessage(message());
    vi.spyOn(internalLogger, 'error').mockImplementation(() => undefined);
  });

  it('is reported (not as a handler failure), released for re-delivery and counted as failed in the batch', async () => {
    vi.spyOn(repo, 'completeFenced').mockRejectedValueOnce(new Error('db down'));
    const release = vi.spyOn(repo, 'releaseFenced');
    const onCompletionWriteFailed = vi.fn();
    const onBatchComplete = vi.fn();
    processor = make(repo, { hooks: { onCompletionWriteFailed, onBatchComplete } });
    processor.registerHandler('a.event', ok);
    processor.start();

    await expect(processor.processBatch()).resolves.toMatchObject({ processed: 1 });

    expect(release).toHaveBeenCalledWith('m-1', 'tok-1', { status: MessageStatus.PENDING });
    expect(onCompletionWriteFailed).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm-1' }),
      expect.any(Error),
      { consecutiveFailures: 1, released: true }
    );
    expect(onBatchComplete).toHaveBeenCalledWith(expect.objectContaining({ failed: 1 }));
  });

  it('re-delivers with the retry backoff', async () => {
    vi.useFakeTimers();
    vi.spyOn(repo, 'completeFenced').mockRejectedValueOnce(new Error('db down'));
    const release = vi.spyOn(repo, 'releaseFenced');
    processor = make(repo, { retryBackoff: { initial: 1_000, multiplier: 2, maxDelay: 60_000 } });
    processor.registerHandler('a.event', ok);
    processor.start();

    await processor.processBatch();

    expect(release.mock.calls[0]![2].processAfter?.getTime()).toBe(Date.now() + 1_000);
  });

  it('gives up after maxRetries re-deliveries and leaves the message PROCESSING', async () => {
    vi.spyOn(repo, 'completeFenced').mockRejectedValue(new Error('db down'));
    const onCompletionWriteFailed = vi.fn();
    const handle = vi.fn().mockResolvedValue(undefined);
    processor = make(repo, { maxRetries: 2, hooks: { onCompletionWriteFailed } });
    processor.registerHandler('a.event', { handle });
    processor.start();

    for (let i = 0; i < 4; i++) await processor.processBatch();

    expect(handle).toHaveBeenCalledTimes(3);
    expect(onCompletionWriteFailed.mock.calls.at(-1)![2]).toEqual({
      consecutiveFailures: 3,
      released: false,
    });
    expect(repo.store.get('m-1')?.status).toBe(MessageStatus.PROCESSING);
  });

  it('does not undo a completion that committed before the error surfaced (the fence rejects the release)', async () => {
    const real = repo.completeFenced.bind(repo);
    vi.spyOn(repo, 'completeFenced').mockImplementation(async (id, token) => {
      await real(id, token);
      throw new Error('lost ack');
    });
    const onStaleWrite = vi.fn();
    processor = make(repo, { hooks: { onStaleWrite } });
    processor.registerHandler('a.event', ok);
    processor.start();

    await processor.processBatch();

    expect(repo.store.get('m-1')?.status).toBe(MessageStatus.PROCESSED);
    expect(onStaleWrite).toHaveBeenCalledWith(expect.anything(), 'release');
  });

  it('reports released: false when the release after the failed write also throws', async () => {
    vi.spyOn(repo, 'completeFenced').mockRejectedValue(new Error('db down'));
    vi.spyOn(repo, 'releaseFenced').mockRejectedValue(new Error('db down'));
    const onCompletionWriteFailed = vi.fn();
    processor = make(repo, { hooks: { onCompletionWriteFailed } });
    processor.registerHandler('a.event', ok);
    processor.start();

    await expect(processor.processBatch()).resolves.toMatchObject({ processed: 1 });

    expect(onCompletionWriteFailed.mock.calls[0]![2]).toEqual({
      consecutiveFailures: 1,
      released: false,
    });
    expect(repo.store.get('m-1')?.status).toBe(MessageStatus.PROCESSING);
  });
});

describe('useFencing — failing failure-bookkeeping writes', () => {
  let repo: FencedMemoryRepo;
  beforeEach(async () => {
    repo = new FencedMemoryRepo();
    await repo.saveMessage(message());
    vi.spyOn(internalLogger, 'error').mockImplementation(() => undefined);
  });

  it('recordFailureFenced throwing does not reject the batch and fires no failure hook', async () => {
    vi.spyOn(repo, 'recordFailureFenced').mockRejectedValue(new Error('db down'));
    const onMessageFailed = vi.fn();
    processor = make(repo, { hooks: { onMessageFailed } });
    processor.registerHandler('a.event', failing());
    processor.start();

    await expect(processor.processBatch()).resolves.toMatchObject({ processed: 1 });

    expect(onMessageFailed).not.toHaveBeenCalled();
    expect(repo.store.get('m-1')).toMatchObject({ status: MessageStatus.PROCESSING, attempts: 0 });
  });

  it('retries a throwing releaseFenced once', async () => {
    const release = vi.spyOn(repo, 'releaseFenced').mockRejectedValueOnce(new Error('blip'));
    processor = make(repo);
    processor.registerHandler('a.event', failing());
    processor.start();

    await processor.processBatch();

    expect(release).toHaveBeenCalledTimes(2);
    expect(repo.store.get('m-1')).toMatchObject({ status: MessageStatus.PENDING, attempts: 1 });
  });

  it('leaves the message PROCESSING (attempt counted) when releaseFenced keeps throwing, without rejecting', async () => {
    vi.spyOn(repo, 'releaseFenced').mockRejectedValue(new Error('db down'));
    processor = make(repo);
    processor.registerHandler('a.event', failing());
    processor.start();

    await expect(processor.processBatch()).resolves.toMatchObject({ processed: 1 });

    expect(repo.store.get('m-1')).toMatchObject({ status: MessageStatus.PROCESSING, attempts: 1 });
  });

  it('treats a non-numeric recordFailureFenced result as a contract violation: logged, nothing released', async () => {
    vi.spyOn(repo, 'recordFailureFenced').mockResolvedValue(undefined as unknown as number);
    const release = vi.spyOn(repo, 'releaseFenced');
    const onMessageFailed = vi.fn();
    processor = make(repo, { hooks: { onMessageFailed } });
    processor.registerHandler('a.event', failing());
    processor.start();

    await processor.processBatch();

    expect(release).not.toHaveBeenCalled();
    expect(onMessageFailed).not.toHaveBeenCalled();
  });
});

describe('useFencing — timeout and zombie', () => {
  it("the zombie's late result never reaches the repository and is observable through onLateSettle", async () => {
    vi.useFakeTimers();
    const repo = new FencedMemoryRepo();
    await repo.saveMessage(message());
    const complete = vi.spyOn(repo, 'completeFenced');
    const record = vi.spyOn(repo, 'recordFailureFenced');
    const onLateSettle = vi.fn();
    let release!: () => void;
    let calls = 0;
    processor = make(repo, { messageTimeout: 1_000, hooks: { onLateSettle } });
    processor.registerHandler('a.event', {
      handle: () =>
        ++calls === 1
          ? new Promise<void>(resolve => {
              release = resolve;
            })
          : Promise.resolve(),
    });
    processor.start();

    const first = processor.processBatch();
    await vi.advanceTimersByTimeAsync(1_000);
    await first;
    await processor.processBatch();
    release();
    await vi.advanceTimersByTimeAsync(10);

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith('m-1', 'tok-1', expect.any(Error));
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith('m-1', 'tok-2');
    expect(onLateSettle).toHaveBeenCalledWith(expect.anything(), 'resolved', expect.any(Number));
  });
});

/**
 * Behavioural-BC regression suite (docs/process/behavioral-bc-checklist.md, item 6):
 * WITHOUT any opt-in the pre-existing behaviour must be unchanged.
 */
describe('default path (no opt-in) — behaviour unchanged', () => {
  class FlakyRepo extends FencedMemoryRepo {
    failProcessedWrites = true;
    failPendingWrites = false;
    pendingWriteAttempts = 0;
    override async updateStatus(id: string, status: MessageStatus): Promise<void> {
      if (status === MessageStatus.PROCESSED && this.failProcessedWrites)
        throw new Error('db down');
      if (status === MessageStatus.PENDING) {
        this.pendingWriteAttempts++;
        if (this.failPendingWrites) throw new Error('db down');
      }
      return super.updateStatus(id, status);
    }
  }
  const legacyProcessor = (repo: IOutboxRepository, options: OutboxProcessorOptions = {}) =>
    make(repo, { useFencing: false, ...options });

  beforeEach(() => {
    vi.spyOn(internalLogger, 'error').mockImplementation(() => undefined);
  });

  it('a failing PROCESSED write is still a HANDLER failure: attempt counted, onMessageFailed fired, retried', async () => {
    const repo = new FlakyRepo();
    await repo.saveMessage(message());
    const incrementAttempt = vi.spyOn(repo, 'incrementAttempt');
    const getById = vi.spyOn(repo, 'getById');
    const onMessageFailed = vi.fn();
    const onCompletionWriteFailed = vi.fn();
    processor = legacyProcessor(repo, { hooks: { onMessageFailed, onCompletionWriteFailed } });
    processor.registerHandler('a.event', ok);
    processor.start();

    await processor.processBatch();

    expect(incrementAttempt).toHaveBeenCalledTimes(1);
    expect(onMessageFailed).toHaveBeenCalledWith(expect.anything(), expect.any(Error), 1);
    expect(onCompletionWriteFailed).not.toHaveBeenCalled();
    expect(getById).not.toHaveBeenCalled(); // no read-back on the default path
    expect(repo.store.get('m-1')).toMatchObject({ status: MessageStatus.PENDING, attempts: 1 });
  });

  it('keeps failing writes until maxRetries, then marks the message FAILED and fires onPermanentFailure', async () => {
    const repo = new FlakyRepo();
    await repo.saveMessage(message());
    const onPermanentFailure = vi.fn();
    processor = legacyProcessor(repo, { maxRetries: 2, hooks: { onPermanentFailure } });
    processor.registerHandler('a.event', ok);
    processor.start();

    for (let i = 0; i < 3; i++) await processor.processBatch();

    expect(repo.store.get('m-1')).toMatchObject({ status: MessageStatus.FAILED, attempts: 2 });
    expect(onPermanentFailure).toHaveBeenCalledOnce();
  });

  it('does not retry a failing closing write (one attempt, then the error is logged)', async () => {
    const repo = new FlakyRepo();
    repo.failProcessedWrites = false;
    repo.failPendingWrites = true;
    await repo.saveMessage(message());
    processor = legacyProcessor(repo);
    processor.registerHandler('a.event', failing());
    processor.start();

    await expect(processor.processBatch()).resolves.toMatchObject({ processed: 1 });

    expect(repo.pendingWriteAttempts).toBe(1);
  });

  it('tolerates an incrementAttempt that returns a non-number (as before): the message is reset to PENDING', async () => {
    const repo = new FlakyRepo();
    repo.failProcessedWrites = false;
    await repo.saveMessage(message());
    vi.spyOn(repo, 'incrementAttempt').mockResolvedValue(undefined as unknown as number);
    processor = legacyProcessor(repo);
    processor.registerHandler('a.event', failing());
    processor.start();

    await processor.processBatch();

    expect(repo.store.get('m-1')?.status).toBe(MessageStatus.PENDING);
  });

  it('an unchanged-signature repository keeps working: resetStaleProcessing(olderThan) with one parameter', () => {
    class OneParam extends FencedMemoryRepo {
      override async resetStaleProcessing(_olderThan: Date): Promise<number> {
        return 0;
      }
    }
    expect(() =>
      legacyProcessor(new OneParam(), { crashRecoveryIntervalMs: 10_000 })
    ).not.toThrow();
  });
});
