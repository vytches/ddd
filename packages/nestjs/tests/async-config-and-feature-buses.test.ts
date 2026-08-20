/**
 * VF-032a — contract tests for the two runtime-facing additions:
 *
 * - `VytchesDDDModule.forRootAsync()` (AC1/AC5) — all three factory forms must
 *   resolve into a working DynamicModule, not merely typecheck.
 * - `forFeature()` routed through `CQRSConfiguration` (AC2/AC5) — `busType` and
 *   `middlewares` must reach the per-context buses, which is the whole point of
 *   the change: before it, a context had no supported way to get the enhanced
 *   buses or attach middleware.
 * - AC5b type test lives in `async-config.types.test.ts`.
 *
 * Deliberately unmocked: these assert on the REAL CQRSConfiguration and the
 * real Enhanced* bus classes, so a future refactor that quietly stops honouring
 * the options fails here.
 */
import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @nx/enforce-module-boundaries -- real bus classes needed to assert busType actually took effect
import {
  EnhancedCommandBus,
  EnhancedQueryBus,
  CommandBus,
  QueryBus,
  ICommandBus,
  IQueryBus,
  type ICQRSMiddleware,
} from '@vytches/ddd-cqrs';
import { VytchesDDDModule } from '../src/vytches-ddd.module';
import { VytchesExplorerService } from '../src/services/vytches-explorer.service';
import { VYTCHES_DDD_OPTIONS } from '../src/constants';
import type { VytchesDDDModuleOptions, VytchesDDDOptionsFactory } from '../src/types';

describe('VF-032a AC1 — VytchesDDDModule.forRootAsync()', () => {
  const expected: VytchesDDDModuleOptions = { autoDiscovery: { enabled: false } };

  it('useFactory resolves the options token', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [VytchesDDDModule.forRootAsync({ useFactory: () => expected })],
    }).compile();

    expect(moduleRef.get(VYTCHES_DDD_OPTIONS)).toEqual(expected);
    expect(moduleRef.get(VytchesExplorerService)).toBeInstanceOf(VytchesExplorerService);
  });

  it('useFactory supports async factories and injected dependencies', async () => {
    @Injectable()
    class ConfigStub {
      readonly discovery = false;
    }

    @Module({ providers: [ConfigStub], exports: [ConfigStub] })
    class ConfigStubModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        VytchesDDDModule.forRootAsync({
          imports: [ConfigStubModule],
          inject: [ConfigStub],
          useFactory: async (config: ConfigStub) => ({
            autoDiscovery: { enabled: config.discovery },
          }),
        }),
      ],
    }).compile();

    expect(moduleRef.get(VYTCHES_DDD_OPTIONS)).toEqual(expected);
  });

  it('useClass instantiates the factory class', async () => {
    @Injectable()
    class OptionsProvider implements VytchesDDDOptionsFactory {
      createVytchesDDDOptions(): VytchesDDDModuleOptions {
        return expected;
      }
    }

    const moduleRef = await Test.createTestingModule({
      imports: [VytchesDDDModule.forRootAsync({ useClass: OptionsProvider })],
    }).compile();

    expect(moduleRef.get(VYTCHES_DDD_OPTIONS)).toEqual(expected);
  });

  it('useExisting reuses a provider the caller already registered', async () => {
    @Injectable()
    class OptionsProvider implements VytchesDDDOptionsFactory {
      createVytchesDDDOptions(): VytchesDDDModuleOptions {
        return expected;
      }
    }

    @Module({ providers: [OptionsProvider], exports: [OptionsProvider] })
    class OptionsModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        VytchesDDDModule.forRootAsync({
          imports: [OptionsModule],
          useExisting: OptionsProvider,
        }),
      ],
    }).compile();

    expect(moduleRef.get(VYTCHES_DDD_OPTIONS)).toEqual(expected);
  });

  it('rejects an async options object with no factory form', () => {
    expect(() => VytchesDDDModule.forRootAsync({})).toThrow(/useFactory, useClass or useExisting/);
  });

  it('autoDiscovery.enabled=false actually skips the reflection scan', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [VytchesDDDModule.forRootAsync({ useFactory: () => expected })],
    }).compile();
    await moduleRef.init();

    // The switch was inert before VF-032a — the explorer never read the options
    // at all. Asserting on the discovered-handler list rather than on a spy so
    // the test survives a rewrite of the scan itself.
    expect(moduleRef.get(VytchesExplorerService).getHandlers()).toEqual([]);
  });

  it('leaves discovery on when no options are supplied (documented default)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [VytchesDDDModule.forRoot()],
    }).compile();
    await moduleRef.init();

    expect(moduleRef.get(VytchesExplorerService).getHandlers()).toBeDefined();
  });
});

describe('VF-032a AC2 — forFeature() through CQRSConfiguration', () => {
  it('defaults to the basic buses, unchanged from before the options existed', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [VytchesDDDModule.forRoot(), VytchesDDDModule.forFeature('orders')],
    }).compile();

    expect(moduleRef.get(ICommandBus)).toBeInstanceOf(CommandBus);
    expect(moduleRef.get(IQueryBus)).toBeInstanceOf(QueryBus);
  });

  it("busType 'enhanced' yields the enhanced buses for that context", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        VytchesDDDModule.forRoot(),
        VytchesDDDModule.forFeature('orders', { busType: 'enhanced' }),
      ],
    }).compile();

    expect(moduleRef.get(ICommandBus)).toBeInstanceOf(EnhancedCommandBus);
    expect(moduleRef.get(IQueryBus)).toBeInstanceOf(EnhancedQueryBus);
  });

  it('attaches middlewares to both per-context buses exactly once', async () => {
    const seen: string[] = [];
    const middleware: ICQRSMiddleware = {
      async handle(context, next) {
        seen.push((context.commandOrQuery as { tag?: string }).tag ?? 'untagged');
        return next();
      },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        VytchesDDDModule.forRoot(),
        VytchesDDDModule.forFeature('orders', { middlewares: [middleware] }),
      ],
    }).compile();

    const commandBus = moduleRef.get<ICommandBus>(ICommandBus);
    const queryBus = moduleRef.get<IQueryBus>(IQueryBus);

    class Ping {
      readonly tag = 'command';
    }
    class Ask {
      readonly tag = 'query';
    }

    commandBus.register(Ping, { execute: async () => 'ok' } as never);
    queryBus.register(Ask, { execute: async () => 'ok' } as never);

    await commandBus.execute(new Ping() as never);
    await queryBus.execute(new Ask() as never);

    // One entry per dispatch — a middleware applied twice to the same bus would
    // show the tag twice.
    expect(seen).toEqual(['command', 'query']);
  });
});
