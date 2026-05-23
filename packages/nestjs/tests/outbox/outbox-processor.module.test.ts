import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, it, expect, vi } from 'vitest';
import { InMemoryOutboxRepository } from '@vytches/ddd-testing';
import type { IOutboxMessageHandler } from '@vytches/ddd-messaging';

import { OutboxProcessorModule } from '../../src/outbox';
import type { OutboxProcessorService } from '../../src/outbox';

const OUTBOX_REPO = 'OUTBOX_REPO';
const OUTBOX_REPO_B = 'OUTBOX_REPO_B';
const OUTBOX_HANDLERS = 'OUTBOX_HANDLERS';
const PROC_A = 'PROC_A';
const PROC_B = 'PROC_B';

// Keep the processing interval huge so the poll timer never fires during the
// test — we only assert lifecycle (start/stop) and handler registration.
const IDLE = { processingInterval: 1_000_000 };

/**
 * Exposes the repository/handler tokens as a global module so the factory
 * inside OutboxProcessorModule (which injects by these tokens) can resolve them.
 */
function tokensModule(providers: Array<{ provide: string; useValue: unknown }>) {
  @Global()
  @Module({ providers, exports: providers.map(p => p.provide) })
  class TokensModule {}
  return TokensModule;
}

describe('OutboxProcessorModule', () => {
  it('starts the processor on init and stops it on destroy', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        OutboxProcessorModule.forRootAsync({
          imports: [
            tokensModule([{ provide: OUTBOX_REPO, useValue: new InMemoryOutboxRepository() }]),
          ],
          processors: [{ repositoryToken: OUTBOX_REPO, processorToken: PROC_A, options: IDLE }],
        }),
      ],
    }).compile();

    await moduleRef.init();
    const processor = moduleRef.get<OutboxProcessorService>(PROC_A);
    expect((await processor.getStats()).isRunning).toBe(true);

    await moduleRef.close();
    expect((await processor.getStats()).isRunning).toBe(false);
  });

  it('registers handlers from the handlerToken map before starting', async () => {
    const handlers: Record<string, IOutboxMessageHandler> = {
      'evt.a': { handle: vi.fn().mockResolvedValue(undefined) },
      'evt.b': { handle: vi.fn().mockResolvedValue(undefined) },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        OutboxProcessorModule.forRootAsync({
          imports: [
            tokensModule([
              { provide: OUTBOX_REPO, useValue: new InMemoryOutboxRepository() },
              { provide: OUTBOX_HANDLERS, useValue: handlers },
            ]),
          ],
          processors: [
            {
              repositoryToken: OUTBOX_REPO,
              handlerToken: OUTBOX_HANDLERS,
              processorToken: PROC_A,
              options: IDLE,
            },
          ],
        }),
      ],
    }).compile();

    await moduleRef.init();
    const processor = moduleRef.get<OutboxProcessorService>(PROC_A);
    const stats = await processor.getStats();
    expect(stats.registeredHandlers).toEqual(expect.arrayContaining(['evt.a', 'evt.b']));

    await moduleRef.close();
  });

  it('creates an independent processor instance per entry', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        OutboxProcessorModule.forRootAsync({
          imports: [
            tokensModule([
              { provide: OUTBOX_REPO, useValue: new InMemoryOutboxRepository() },
              { provide: OUTBOX_REPO_B, useValue: new InMemoryOutboxRepository() },
            ]),
          ],
          processors: [
            {
              repositoryToken: OUTBOX_REPO,
              processorToken: PROC_A,
              options: { ...IDLE, batchSize: 200 },
            },
            {
              repositoryToken: OUTBOX_REPO_B,
              processorToken: PROC_B,
              options: { ...IDLE, batchSize: 50, messageTypes: ['GdprAuditChainAppend'] },
            },
          ],
        }),
      ],
    }).compile();

    await moduleRef.init();
    const a = moduleRef.get<OutboxProcessorService>(PROC_A);
    const b = moduleRef.get<OutboxProcessorService>(PROC_B);

    expect(a).not.toBe(b);
    expect((await a.getStats()).batchSize).toBe(200);
    expect((await b.getStats()).batchSize).toBe(50);
    expect((await a.getStats()).isRunning).toBe(true);
    expect((await b.getStats()).isRunning).toBe(true);

    await moduleRef.close();
  });
});
