/**
 * Coverage for the wiring shapes our own documentation teaches.
 *
 * Every other integration test wires buses through `forTesting()` (which
 * registers stubs directly under the Symbol tokens) or through
 * `forRoot({ providers })`. Neither exercises the shape published in
 * `packages/nestjs/LLMGUIDE.md` ("Global DDD Module (full wiring)") and in the
 * `VytchesDDDModule` class JSDoc, where the consumer declares the buses as
 * *sibling* providers of their own module and merely imports
 * `VytchesDDDModule.forRoot()`.
 *
 * Both shapes do resolve the buses: the `forRoot()` bridge providers reach a
 * sibling provider as long as the consumer module exports it (and `@Global()`
 * makes it reachable from anywhere). These tests exist so that stays true —
 * a regression here silently disables every command and query handler, which
 * is exactly the failure a consumer hit after upgrading.
 *
 * VP-009 follow-up.
 */
import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { Global, Inject, Injectable, Module } from '@nestjs/common';
// eslint-disable-next-line @nx/enforce-module-boundaries -- DI tokens are needed verbatim
import { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
import { VytchesDDDModule } from '../src/vytches-ddd.module';
import { VytchesExplorerService } from '../src/services/vytches-explorer.service';
import { GLOBAL_COMMAND_BUS, GLOBAL_QUERY_BUS } from '../src/constants';

const busStub = () => ({
  register: () => undefined,
  registerFactory: () => undefined,
  reset: () => undefined,
  execute: () => Promise.resolve(),
});

describe('documented wiring shape — buses as sibling providers (LLMGUIDE "Global DDD Module")', () => {
  it('explorer resolves both buses when the consumer module declares them alongside forRoot()', async () => {
    @Global()
    @Module({
      imports: [VytchesDDDModule.forRoot()],
      providers: [
        { provide: ICommandBus, useFactory: busStub },
        { provide: IQueryBus, useFactory: busStub },
      ],
      exports: [ICommandBus, IQueryBus],
    })
    class ConsumerDDDModule {}

    const module = await Test.createTestingModule({
      imports: [ConsumerDDDModule],
    }).compile();

    const explorer = module.get(VytchesExplorerService, { strict: false });

    expect(explorer.hasCommandBus()).toBe(true);
    expect(explorer.hasQueryBus()).toBe(true);

    await module.close();
  });

  it('explorer resolves both buses under forContext()', async () => {
    // forContext() creates its own explorer instances, so it needs the same
    // Symbol→class bridge forRoot() has. It did not have it, which left every
    // per-context explorer without a bus.
    const module = await Test.createTestingModule({
      imports: [
        VytchesDDDModule.forContext('orders', {
          providers: [
            { provide: ICommandBus, useFactory: busStub },
            { provide: IQueryBus, useFactory: busStub },
          ],
        }),
      ],
    }).compile();

    const explorer = module.get(VytchesExplorerService, { strict: false });

    expect(explorer.hasCommandBus()).toBe(true);
    expect(explorer.hasQueryBus()).toBe(true);

    await module.close();
  });

  it('explorer resolves both buses under forContexts()', async () => {
    const module = await Test.createTestingModule({
      imports: [
        VytchesDDDModule.forContexts({
          contexts: ['orders', 'billing'],
          providers: [
            { provide: ICommandBus, useFactory: busStub },
            { provide: IQueryBus, useFactory: busStub },
          ],
        }),
      ],
    }).compile();

    const explorer = module.get(VytchesExplorerService, { strict: false });

    expect(explorer.hasCommandBus()).toBe(true);
    expect(explorer.hasQueryBus()).toBe(true);

    await module.close();
  });

  it('explorer resolves both buses when they are passed into forRoot({ providers })', async () => {
    // Control case — the shape published in packages/nestjs/README.md.
    const module = await Test.createTestingModule({
      imports: [
        VytchesDDDModule.forRoot({
          providers: [
            { provide: ICommandBus, useFactory: busStub },
            { provide: IQueryBus, useFactory: busStub },
          ],
        }),
      ],
    }).compile();

    const explorer = module.get(VytchesExplorerService, { strict: false });

    expect(explorer.hasCommandBus()).toBe(true);
    expect(explorer.hasQueryBus()).toBe(true);

    await module.close();
  });
});

/**
 * `forRoot({ providers })` puts the buses inside `VytchesDDDModule`. Handler
 * discovery is unaffected (the explorer resolves handlers through `ModuleRef`,
 * not through DI visibility), so this only bites when application code — a
 * controller, an HTTP adapter, a scheduled job — injects a bus by constructor
 * from a *different* module. `options.exports` is what makes that work; before
 * it was honoured, the field was declared on `VytchesDDDModuleOptions` and
 * silently dropped, and the failure surfaced as an opaque bootstrap error.
 */
describe('forRoot({ providers }) — reaching the buses from another module', () => {
  @Injectable()
  class NeedsCommandBus {
    constructor(@Inject(ICommandBus) readonly bus: ICommandBus) {}
  }

  const rootWith = (exports?: unknown[]) =>
    VytchesDDDModule.forRoot({
      providers: [
        { provide: ICommandBus, useFactory: busStub },
        { provide: IQueryBus, useFactory: busStub },
      ],
      ...(exports ? { exports: exports as never } : {}),
    });

  it('exports its own three tokens even when the caller passes none', async () => {
    const dynamic = VytchesDDDModule.forRoot();

    expect(dynamic.exports).toEqual([VytchesExplorerService, GLOBAL_COMMAND_BUS, GLOBAL_QUERY_BUS]);
  });

  it('appends options.exports after its own tokens rather than replacing them', () => {
    const dynamic = rootWith([ICommandBus, IQueryBus]);

    expect(dynamic.exports).toEqual([
      VytchesExplorerService,
      GLOBAL_COMMAND_BUS,
      GLOBAL_QUERY_BUS,
      ICommandBus,
      IQueryBus,
    ]);
  });

  it('lets a provider in another module inject a bus declared via options.exports', async () => {
    @Module({ imports: [rootWith([ICommandBus])], providers: [NeedsCommandBus] })
    class ConsumerModule {}

    const moduleRef = await Test.createTestingModule({ imports: [ConsumerModule] }).compile();

    expect(moduleRef.get(NeedsCommandBus, { strict: false }).bus).toBeDefined();

    await moduleRef.close();
  });

  it('still fails, by design, when the bus is provided but never exported', async () => {
    @Module({ imports: [rootWith()], providers: [NeedsCommandBus] })
    class ConsumerModule {}

    await expect(Test.createTestingModule({ imports: [ConsumerModule] }).compile()).rejects.toThrow(
      /ICommandBus/
    );
  });

  it('honours options.exports in forTesting() too', () => {
    const token = Symbol('SOME_TEST_DOUBLE');
    const dynamic = VytchesDDDModule.forTesting({
      providers: [{ provide: token, useValue: {} }],
      exports: [token],
    });

    expect(dynamic.exports).toContain(token);
    // its own tokens are still there
    expect(dynamic.exports).toContain(VytchesExplorerService);
  });
});
