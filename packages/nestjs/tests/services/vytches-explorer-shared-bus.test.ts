/**
 * VB-003 / D-3 — integration test for the F-M5 duplicate-registration guard
 * (TM-VB-003-002, DREAD 9-11, AC #5) at the exact scenario the finding
 * describes: TWO `VytchesExplorerService` instances — one standing in for
 * `forRoot()`'s global explorer, one standing in for `forContext()`'s
 * per-context explorer — that both discover the SAME handler and both
 * resolve the SAME shared bus object (the real-world case when the
 * shadowed/bridged `ICommandBus`/`IQueryBus`/`IEventBus` tokens resolve to
 * one process-wide bus instance).
 *
 * Without `BusRegistrationLedger`, both explorer instances would call
 * `bus.registerFactory()` / `bus.registerHandler()` for the same handler,
 * silently double-registering it (or worse, masking a genuine conflict).
 * With the guard in place:
 *   - a repeated (messageType, handlerType) claim on the shared bus is
 *     skipped — the bus method is invoked exactly once;
 *   - a genuine conflict (two DIFFERENT handler types for the same
 *     messageType) throws, and — because `strictHandlerRegistration` is a
 *     real, reachable option via the new `configureContext()` API — that
 *     throw surfaces out of `onApplicationBootstrap()`/`registerHandler()`
 *     instead of being silently swallowed;
 *   - legitimate event fan-out (distinct handler types for the same event
 *     type) is never treated as a conflict.
 *
 * This test constructs `VytchesExplorerService` directly (bypassing the
 * NestJS DI container) so it can control bus sharing precisely and does not
 * depend on `DiscoveryService`/`ModuleRef` internals, which are irrelevant
 * to the guard being tested here.
 */
import { describe, it, expect, vi } from 'vitest';
import type { ModuleRef, DiscoveryService } from '@nestjs/core';
import { VytchesExplorerService } from '../../src/services/vytches-explorer.service';
import type { HandlerInfo } from '../../src/types';

class PlaceOrderCommand {}
class PlaceOrderHandler {}
class PlaceOrderHandlerRogue {}

class OrderPlacedEvent {}
class SendConfirmationEmailHandler {}
class UpdateInventoryHandler {}

// Only moduleRef.get() is exercised (lazily, via the handler factory) — a
// minimal stub is enough since these tests never invoke discoverHandlers().
const fakeModuleRef = { get: vi.fn(() => ({})) } as unknown as ModuleRef;
const fakeDiscoveryService = {} as unknown as DiscoveryService;

function makeSharedBuses(): {
  commandBus: { registerFactory: ReturnType<typeof vi.fn>; register: ReturnType<typeof vi.fn> };
  eventBus: { registerHandler: ReturnType<typeof vi.fn> };
} {
  return {
    commandBus: { registerFactory: vi.fn(), register: vi.fn() },
    eventBus: { registerHandler: vi.fn() },
  };
}

function makeHandlerInfo(
  type: 'command' | 'event',
  messageType: new (...args: unknown[]) => unknown,
  handlerType: new (...args: unknown[]) => unknown
): HandlerInfo {
  return { type, messageType, handlerType, metadata: undefined };
}

describe('D-3 integration: two VytchesExplorerService instances sharing a bus (forRoot() + forContext() scenario)', () => {
  it('skips the duplicate command registration on the shared bus instead of registering it twice', async () => {
    const shared = makeSharedBuses();

    // Stand-in for forRoot()'s global explorer.
    const rootExplorer = new VytchesExplorerService(
      fakeModuleRef,
      fakeDiscoveryService,
      shared.commandBus as never
    );
    // Stand-in for forContext()'s per-context explorer, resolving the SAME
    // underlying command bus object.
    const contextExplorer = new VytchesExplorerService(
      fakeModuleRef,
      fakeDiscoveryService,
      shared.commandBus as never
    );
    contextExplorer.configureContext({ name: 'billing' });

    const handler = makeHandlerInfo('command', PlaceOrderCommand, PlaceOrderHandler);

    await rootExplorer.registerHandler(handler);
    await contextExplorer.registerHandler(handler);

    // The bus must only ever see ONE registration call for this handler,
    // even though two independent explorer instances both attempted it.
    expect(shared.commandBus.registerFactory).toHaveBeenCalledTimes(1);
  });

  it('throws a conflict error when a genuine conflict is registered under strictHandlerRegistration, instead of silently swallowing it', async () => {
    const shared = makeSharedBuses();

    const rootExplorer = new VytchesExplorerService(
      fakeModuleRef,
      fakeDiscoveryService,
      shared.commandBus as never
    );
    const contextExplorer = new VytchesExplorerService(
      fakeModuleRef,
      fakeDiscoveryService,
      shared.commandBus as never
    );
    // Real, reachable configureContext() API (F-M5 / D-3) — this is what
    // makes strictHandlerRegistration actually take effect.
    contextExplorer.configureContext({ name: 'billing', strictHandlerRegistration: true });

    await rootExplorer.registerHandler(
      makeHandlerInfo('command', PlaceOrderCommand, PlaceOrderHandler)
    );

    // A DIFFERENT handler type claiming the SAME messageType on the SAME
    // shared bus is a genuine conflict — must throw, not silently skip.
    await expect(
      contextExplorer.registerHandler(
        makeHandlerInfo('command', PlaceOrderCommand, PlaceOrderHandlerRogue)
      )
    ).rejects.toThrow(/conflicting command handler registration/i);

    // Only the first (legitimate) handler was ever registered on the bus.
    expect(shared.commandBus.registerFactory).toHaveBeenCalledTimes(1);
  });

  it('does not throw a conflict for a genuine conflict when strictHandlerRegistration is left at its default (off) — logs and skips instead', async () => {
    const shared = makeSharedBuses();

    const rootExplorer = new VytchesExplorerService(
      fakeModuleRef,
      fakeDiscoveryService,
      shared.commandBus as never
    );
    const contextExplorer = new VytchesExplorerService(
      fakeModuleRef,
      fakeDiscoveryService,
      shared.commandBus as never
    );
    // No configureContext() call — strictHandlerRegistration stays false,
    // preserving pre-existing backward-compatible boot behavior.

    await rootExplorer.registerHandler(
      makeHandlerInfo('command', PlaceOrderCommand, PlaceOrderHandler)
    );

    await expect(
      contextExplorer.registerHandler(
        makeHandlerInfo('command', PlaceOrderCommand, PlaceOrderHandlerRogue)
      )
    ).resolves.toBeUndefined();

    expect(shared.commandBus.registerFactory).toHaveBeenCalledTimes(1);
  });

  it('allows legitimate event fan-out across two explorer instances sharing an event bus — distinct handler types never conflict', async () => {
    const shared = makeSharedBuses();

    const rootExplorer = new VytchesExplorerService(
      fakeModuleRef,
      fakeDiscoveryService,
      undefined,
      undefined,
      shared.eventBus as never
    );
    const contextExplorer = new VytchesExplorerService(
      fakeModuleRef,
      fakeDiscoveryService,
      undefined,
      undefined,
      shared.eventBus as never
    );
    contextExplorer.configureContext({ name: 'billing' });

    await rootExplorer.registerHandler(
      makeHandlerInfo('event', OrderPlacedEvent, SendConfirmationEmailHandler)
    );
    await contextExplorer.registerHandler(
      makeHandlerInfo('event', OrderPlacedEvent, UpdateInventoryHandler)
    );

    // Both distinct handlers register — fan-out is legitimate, not a conflict.
    expect(shared.eventBus.registerHandler).toHaveBeenCalledTimes(2);

    // Re-registering the exact same (eventType, handlerType) pair again is
    // deduped as an idempotent no-op.
    await rootExplorer.registerHandler(
      makeHandlerInfo('event', OrderPlacedEvent, SendConfirmationEmailHandler)
    );
    expect(shared.eventBus.registerHandler).toHaveBeenCalledTimes(2);
  });
});
