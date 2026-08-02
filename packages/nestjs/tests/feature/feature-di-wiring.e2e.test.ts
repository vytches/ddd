/**
 * VB-003 / D-8c — end-to-end regression test for F-C4 (TM-VB-003-001, DREAD 14).
 *
 * F-C4 bug: `VytchesDDDFeatureModule.forFeature()` previously listed the bare
 * class `ModulesContainer` in its `providers` array. In NestJS, a bare class in
 * `providers` is shorthand for `{ provide: ModulesContainer, useClass:
 * ModulesContainer }`, which SHADOWS the real, globally-provided
 * `ModulesContainer` singleton (from `InternalCoreModule`) with a brand-new,
 * empty instance scoped to the feature module. `FeatureHandlerRegistrar`
 * injected this shadowed, empty container and could never find its own module
 * or the consumer module that imported it — so:
 *   - forFeature()-scoped handlers were silently NEVER registered locally, and
 *   - because `claimHandlerTypes()` was consequently never called, the SAME
 *     handler was picked up by `VytchesExplorerService`'s global fallback in
 *     `onApplicationBootstrap()` and registered on the ROOT/GLOBAL bus instead
 *     — a cross-context information disclosure: a handler meant to be private
 *     to one bounded context becomes reachable through the global bus.
 *
 * This file exercises the REAL NestJS DI container end-to-end (unlike
 * `feature-handler-registrar.test.ts`, which only tests the traversal
 * algorithm against a hand-built `Map` stand-in for `ModulesContainer`) via a
 * real `Test.createTestingModule({ imports: [...] }).compile()` ->
 * `app.init()` cycle, asserting the four guarantees required by D-8c:
 *
 *   1. A `@CommandHandler`-decorated handler living inside a forFeature()-
 *      scoped module registers on the LOCAL bus, not the global bus.
 *   2. A domain event dispatched through that context's
 *      `ContextAwareEventDispatcher` reaches subscribers via the LOCAL event
 *      bus.
 *   3. An explicit `ModulesContainer` identity/size probe: the container
 *      resolved by `app.get(ModulesContainer)` must be reference-equal to (and
 *      report the same size as) the container `FeatureHandlerRegistrar`
 *      actually receives via DI — this directly encodes the original audit's
 *      "size=0 local vs size=N global" symptom, so a regression is caught even
 *      if the behavioral assertions alone would still pass.
 *   4. After `app.close()`, `onModuleDestroy()`'s dispose() branches are
 *      invoked on the local buses.
 *
 * OQ-6 (also covered here): the two-phase `onModuleInit` -> `onApplicationBootstrap`
 * lifecycle split guarantees `FeatureHandlerRegistrar.claimHandlerTypes()`
 * (run in onModuleInit) always completes, app-wide, before
 * `VytchesExplorerService.onApplicationBootstrap()` attempts global fallback
 * registration — so a claimed handler must never appear on the global bus.
 */
import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { Injectable, Module } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- runtime class needed to resolve the real DI token
import { ModulesContainer } from '@nestjs/core';

// eslint-disable-next-line @nx/enforce-module-boundaries -- Required for DI tokens in a cross-package e2e test
import { CommandHandler, ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
import type { ICommand } from '@vytches/ddd-cqrs';
import { DomainEvent } from '@vytches/ddd-events';

import { VytchesDDDModule } from '../../src/vytches-ddd.module';
import { LOCAL_EVENT_BUS } from '../../src/constants';
import { ContextAwareEventDispatcher } from '../../src/dispatchers/context-aware-event-dispatcher';
import { FeatureHandlerRegistrar } from '../../src/feature/feature-handler-registrar';

// ─── Test fixtures ────────────────────────────────────────────────────────────

class PlaceTestOrderCommand implements ICommand {
  constructor(public readonly orderId: string) {}
}

// Decorated with the REAL @CommandHandler decorator (default autoRegister:
// true) so this handler is picked up by BOTH FeatureHandlerRegistrar's local
// discovery AND VytchesExplorerService's global auto-discovery — exactly the
// race the F-C4 fix and OQ-6 lifecycle ordering must resolve correctly.
@CommandHandler(PlaceTestOrderCommand)
@Injectable()
class PlaceTestOrderHandler {
  execute(command: PlaceTestOrderCommand): Promise<string> {
    return Promise.resolve(`handled:${command.orderId}`);
  }
}

class TestOrderPlacedEvent extends DomainEvent<{ orderId: string }> {}

@Module({
  imports: [VytchesDDDModule.forFeature('test-orders')],
  providers: [PlaceTestOrderHandler],
})
class TestOrdersFeatureConsumerModule {}

describe('D-8c e2e: forFeature() real DI wiring — F-C4 / TM-VB-003-001 regression gate', () => {
  it('isolates a forFeature()-scoped handler on the local bus, delivers domain events locally, keeps ModulesContainer identity intact, and disposes local buses on shutdown', async () => {
    // A stand-in for the ROOT/GLOBAL command bus. If F-C4 regresses, the
    // handler below leaks here via VytchesExplorerService's global fallback.
    const globalCommandBus = {
      register: vi.fn(),
      registerFactory: vi.fn(),
      execute: vi.fn().mockRejectedValue(new Error('no handler registered on global bus')),
    };
    const globalQueryBus = {
      register: vi.fn(),
      registerFactory: vi.fn(),
      send: vi.fn().mockRejectedValue(new Error('no handler registered on global bus')),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        VytchesDDDModule.forRoot({
          providers: [
            { provide: ICommandBus, useValue: globalCommandBus },
            { provide: IQueryBus, useValue: globalQueryBus },
          ],
        }),
        TestOrdersFeatureConsumerModule,
      ],
    }).compile();

    const app = moduleRef.createNestApplication();
    // app.init() runs onModuleInit() for ALL modules (including
    // FeatureHandlerRegistrar's local claim + VytchesExplorerService's
    // discovery-only phase), then onApplicationBootstrap() for
    // VytchesExplorerService's global-fallback phase — the real, unmocked
    // NestJS lifecycle ordering that OQ-6 depends on.
    await app.init();

    // ─── Item 3: ModulesContainer identity/size probe ──────────────────────
    // Encodes the original audit's "size=0 local vs size=N global" symptom.
    // Before the F-C4 fix, forFeature()'s bare `ModulesContainer` provider
    // shadowed the real container with a fresh, empty instance local to the
    // feature module, so FeatureHandlerRegistrar received a container with
    // size 0 while the real app-wide container had size N > 0.
    const rootModulesContainer = app.get(ModulesContainer);
    const registrar = app.get(FeatureHandlerRegistrar, { strict: false });
    const registrarModulesContainer = (
      registrar as unknown as { modulesContainer: ModulesContainer }
    ).modulesContainer;

    expect(registrarModulesContainer).toBe(rootModulesContainer);
    expect(registrarModulesContainer.size).toBe(rootModulesContainer.size);
    expect(registrarModulesContainer.size).toBeGreaterThan(0);

    // ─── Item 1: handler registers on the LOCAL bus, not the global bus ────
    const featureModuleRef = moduleRef.select(TestOrdersFeatureConsumerModule);
    const localCommandBus = featureModuleRef.get<ICommandBus>(ICommandBus, { strict: false });

    expect(localCommandBus).not.toBe(globalCommandBus);

    const result = await localCommandBus.execute<PlaceTestOrderCommand, string>(
      new PlaceTestOrderCommand('order-1')
    );
    expect(result).toBe('handled:order-1');

    // The global bus must never have seen this handler registered — this is
    // OQ-6's "claimed handler never appears on the global bus" guarantee,
    // exercised end-to-end via the real onModuleInit -> onApplicationBootstrap
    // cross-module ordering (not a unit-level mock of that ordering).
    expect(globalCommandBus.register).not.toHaveBeenCalled();
    expect(globalCommandBus.registerFactory).not.toHaveBeenCalled();
    await expect(globalCommandBus.execute(new PlaceTestOrderCommand('order-1'))).rejects.toThrow(
      'no handler registered on global bus'
    );

    // ─── Item 2: domain event dispatched through the local context reaches
    // subscribers via the LOCAL event bus ────────────────────────────────────
    const localEventBus = featureModuleRef.get<{
      subscribe: (eventName: unknown, handler: (event: unknown) => void) => void;
    }>(LOCAL_EVENT_BUS, { strict: false });
    const dispatcher = featureModuleRef.get(ContextAwareEventDispatcher, { strict: false });

    const receivedEvents: TestOrderPlacedEvent[] = [];
    localEventBus.subscribe(TestOrderPlacedEvent, event => {
      receivedEvents.push(event as TestOrderPlacedEvent);
    });

    const domainEvent = new TestOrderPlacedEvent({ orderId: 'order-1' });
    await dispatcher.dispatchEvent(domainEvent);

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0]?.eventId).toBe(domainEvent.eventId);

    // ─── Item 4: onModuleDestroy() dispose() branches invoked on close ─────
    // Real forFeature()-scoped buses (CommandBus/QueryBus/UnifiedEventBus) do
    // not implement dispose() themselves; FeatureHandlerRegistrar.onModuleDestroy()
    // duck-types for a dispose() method ("dispose branches") and calls it only
    // when present. Attach spies directly onto the resolved instances to prove
    // those branches fire on real app shutdown when a dispose() method exists.
    const localQueryBus = featureModuleRef.get<IQueryBus>(IQueryBus, { strict: false });
    const commandBusDispose = vi.fn();
    const queryBusDispose = vi.fn();
    const eventBusDispose = vi.fn();
    (localCommandBus as unknown as { dispose: () => void }).dispose = commandBusDispose;
    (localQueryBus as unknown as { dispose: () => void }).dispose = queryBusDispose;
    (localEventBus as unknown as { dispose: () => void }).dispose = eventBusDispose;

    await app.close();

    expect(commandBusDispose).toHaveBeenCalledTimes(1);
    expect(queryBusDispose).toHaveBeenCalledTimes(1);
    expect(eventBusDispose).toHaveBeenCalledTimes(1);
  });
});
