/**
 * Guards the wiring shape a real application uses: the buses provided by the
 * application's own `@Global()` module, `forRoot()` imported by it, and a
 * SEPARATE module injecting `ICommandBus`.
 *
 * The last part is the whole point. `wiring.test.ts` resolves the bus with
 * `{ strict: false }`, which searches every module and therefore cannot tell
 * where the bus actually lives. Real code injects through a constructor, which
 * can only see its own module's providers, its imports, and global exports —
 * and that is where `forRoot({ providers })` alone stops being enough. The last
 * test pins both halves of the alternative: unexported buses still fail, and
 * `options.exports` fixes it.
 */
import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { Inject, Injectable, Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { EnhancedCommandBus, EnhancedQueryBus, ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
import { NestJSContainerAdapter, VytchesDDDModule } from '@vytches/ddd-nestjs';

import { AppModule, InvoicesApi } from '../src/app-root.module';

describe('application-root wiring', () => {
  it('lets a provider in another module inject the buses through a constructor', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await module.init();

    const api = module.get(InvoicesApi, { strict: false });
    expect(await api.archive('inv-1')).toBe('archived');

    await module.close();
  });

  it('still auto-discovers handlers — nothing is registered by hand', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await module.init();

    // Reached only through auto-discovery: no bus.register() call exists in
    // src/app-root.module.ts.
    const api = module.get(InvoicesApi, { strict: false });
    expect(await api.archive('inv-2')).toBe('archived');

    await module.close();
  });

  it('a bus given to forRoot() is not injectable elsewhere unless it is exported', async () => {
    const root = (exported: boolean) =>
      VytchesDDDModule.forRoot({
        providers: [
          {
            provide: ICommandBus,
            useFactory: (m: ModuleRef) => new EnhancedCommandBus(new NestJSContainerAdapter(m)),
            inject: [ModuleRef],
          },
          {
            provide: IQueryBus,
            useFactory: (m: ModuleRef) => new EnhancedQueryBus(new NestJSContainerAdapter(m)),
            inject: [ModuleRef],
          },
        ],
        ...(exported ? { exports: [ICommandBus, IQueryBus] } : {}),
      });

    @Injectable()
    class NeedsTheBus {
      constructor(@Inject(ICommandBus) readonly bus: ICommandBus) {}
    }

    @Module({ imports: [root(false)], providers: [NeedsTheBus] })
    class WithoutExports {}

    await expect(Test.createTestingModule({ imports: [WithoutExports] }).compile()).rejects.toThrow(
      /ICommandBus/
    );

    @Module({ imports: [root(true)], providers: [NeedsTheBus] })
    class WithExports {}

    const module = await Test.createTestingModule({ imports: [WithExports] }).compile();
    expect(module.get(NeedsTheBus, { strict: false }).bus).toBeDefined();
    await module.close();
  });
});
