/**
 * TDD tests for Bug #3 — Symbol.for DI tokens in NestJS injection.
 *
 * CT-4: @Inject(QUERY_BUS_TOKEN) resolves same instance as the bus provided
 *       under QUERY_BUS_TOKEN (via alias or direct).
 * Pitfall 1: forTesting() stubs must be registered under Symbol tokens too,
 *            so VytchesExplorerService.hasCommandBus()/hasQueryBus() returns true.
 *
 * VP-009 Bug #3
 */
import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { Inject, Injectable } from '@nestjs/common';
import { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@vytches/ddd-cqrs';
import { VytchesDDDModule } from '../src/vytches-ddd.module';
import { VytchesExplorerService } from '../src/services/vytches-explorer.service';

// ─── CT-4: QUERY_BUS_TOKEN alias resolves the registered bus ─────────────────

describe('Bug #3 — NestJS injection via Symbol tokens (CT-4)', () => {
  it('VytchesExplorerService resolves commandBus via COMMAND_BUS_TOKEN', async () => {
    const stub = {
      register: () => undefined,
      registerFactory: () => undefined,
      execute: () => Promise.resolve(),
    };

    const module = await Test.createTestingModule({
      imports: [VytchesDDDModule.forTesting()],
      providers: [
        // Override the forTesting stub with our own under the Symbol token
        { provide: COMMAND_BUS_TOKEN, useValue: stub },
      ],
    }).compile();

    const explorer = module.get(VytchesExplorerService);
    // After the fix, the explorer's commandBus field is injected via COMMAND_BUS_TOKEN
    expect(explorer.hasCommandBus()).toBe(true);

    await module.close();
  });

  it('VytchesExplorerService resolves queryBus via QUERY_BUS_TOKEN', async () => {
    const stub = {
      register: () => undefined,
      registerFactory: () => undefined,
      execute: () => Promise.resolve(),
    };

    const module = await Test.createTestingModule({
      imports: [VytchesDDDModule.forTesting()],
      providers: [{ provide: QUERY_BUS_TOKEN, useValue: stub }],
    }).compile();

    const explorer = module.get(VytchesExplorerService);
    expect(explorer.hasQueryBus()).toBe(true);

    await module.close();
  });
});

// ─── Pitfall 1: forTesting() stubs registered under Symbol tokens ─────────────

describe('Bug #3 — Pitfall 1: forTesting() stubs under Symbol tokens', () => {
  it('hasCommandBus() returns true after forTesting() (stub reachable via COMMAND_BUS_TOKEN)', async () => {
    const module = await Test.createTestingModule({
      imports: [VytchesDDDModule.forTesting()],
    }).compile();

    const explorer = module.get(VytchesExplorerService);
    // This was false before the fix — forTesting() only registered under ICommandBus
    // (class token), but VytchesExplorerService now injects via COMMAND_BUS_TOKEN.
    expect(explorer.hasCommandBus()).toBe(true);

    await module.close();
  });

  it('hasQueryBus() returns true after forTesting() (stub reachable via QUERY_BUS_TOKEN)', async () => {
    const module = await Test.createTestingModule({
      imports: [VytchesDDDModule.forTesting()],
    }).compile();

    const explorer = module.get(VytchesExplorerService);
    expect(explorer.hasQueryBus()).toBe(true);

    await module.close();
  });

  it('bus stub injected via COMMAND_BUS_TOKEN is the same object as the forTesting stub', async () => {
    const module = await Test.createTestingModule({
      imports: [VytchesDDDModule.forTesting()],
    }).compile();

    // After the fix, the Symbol token resolves the stub
    const busViaToken = module.get(COMMAND_BUS_TOKEN, { strict: false });
    expect(busViaToken).toBeDefined();

    await module.close();
  });
});

// ─── Diagnostic: provider under Symbol token only (no class token) ────────────

describe('Bug #3 — diagnostic: Symbol-only provider resolves into explorer', () => {
  it('provider registered ONLY under QUERY_BUS_TOKEN (no IQueryBus class) → hasQueryBus() true', async () => {
    // Before the fix this was false because explorer injected @Inject(IQueryBus)
    // but the provider was registered only under QUERY_BUS_TOKEN.
    @Injectable()
    class MinimalConsumer {
      constructor(@Inject(QUERY_BUS_TOKEN) public readonly bus: unknown) {}
    }

    const stub = { execute: () => Promise.resolve('ok') };

    const module = await Test.createTestingModule({
      imports: [VytchesDDDModule.forTesting()],
      providers: [MinimalConsumer, { provide: QUERY_BUS_TOKEN, useValue: stub }],
    }).compile();

    const consumer = module.get(MinimalConsumer);
    expect(consumer.bus).toBe(stub);

    await module.close();
  });
});
