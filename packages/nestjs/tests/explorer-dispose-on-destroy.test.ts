import type { DiscoveryService, ModuleRef } from '@nestjs/core';
import type { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
import type { IEventBus } from '@vytches/ddd-contracts';
import { describe, it, expect, vi } from 'vitest';
import { VytchesExplorerService } from '../src/services/vytches-explorer.service';

/**
 * VP-011 — onModuleDestroy() must call dispose() (in addition to reset()) on
 * buses that implement IDisposableBus, so the cache-cleanup setInterval is
 * explicitly released instead of accumulating across create→destroy cycles.
 *
 * reset() evicts handler factories; dispose() releases background resources.
 * Both are duck-typed and error-tolerant: a bus without the method is skipped,
 * and a throwing method warns rather than crashing teardown.
 */
describe('VytchesExplorerService.onModuleDestroy() — dispose() (VP-011)', () => {
  // onModuleDestroy() touches neither moduleRef nor discoveryService.
  const moduleRef = {} as ModuleRef;
  const discoveryService = {} as DiscoveryService;

  const makeService = (
    commandBus?: unknown,
    queryBus?: unknown,
    eventBus?: unknown
  ): VytchesExplorerService =>
    new VytchesExplorerService(
      moduleRef,
      discoveryService,
      commandBus as ICommandBus | undefined,
      queryBus as IQueryBus | undefined,
      eventBus as IEventBus | undefined
    );

  it('calls dispose() after reset() on a bus that implements IDisposableBus', () => {
    const calls: string[] = [];
    const bus = {
      reset: vi.fn(() => void calls.push('reset')),
      dispose: vi.fn(() => void calls.push('dispose')),
    };

    makeService(bus).onModuleDestroy();

    expect(bus.reset).toHaveBeenCalledOnce();
    expect(bus.dispose).toHaveBeenCalledOnce();
    // Ordering matters: state is cleared before I/O is released.
    expect(calls).toEqual(['reset', 'dispose']);
  });

  it('disposes every disposable bus (command, query, event)', () => {
    const commandBus = { reset: vi.fn(), dispose: vi.fn() };
    const queryBus = { reset: vi.fn(), dispose: vi.fn() };
    const eventBus = { reset: vi.fn(), dispose: vi.fn() };

    makeService(commandBus, queryBus, eventBus).onModuleDestroy();

    for (const bus of [commandBus, queryBus, eventBus]) {
      expect(bus.dispose).toHaveBeenCalledOnce();
    }
  });

  it('skips dispose() gracefully on a reset-only bus (no dispose method)', () => {
    const bus = { reset: vi.fn() };

    expect(() => makeService(bus).onModuleDestroy()).not.toThrow();
    expect(bus.reset).toHaveBeenCalledOnce();
    expect('dispose' in bus).toBe(false);
  });

  it('does not throw and still disposes when reset() throws', () => {
    const bus = {
      reset: vi.fn(() => {
        throw new Error('reset boom');
      }),
      dispose: vi.fn(),
    };

    expect(() => makeService(bus).onModuleDestroy()).not.toThrow();
    // A failing reset() must not prevent dispose() from releasing resources.
    expect(bus.dispose).toHaveBeenCalledOnce();
  });

  it('does not throw when dispose() itself throws', () => {
    const bus = {
      reset: vi.fn(),
      dispose: vi.fn(() => {
        throw new Error('dispose boom');
      }),
    };

    expect(() => makeService(bus).onModuleDestroy()).not.toThrow();
    expect(bus.dispose).toHaveBeenCalledOnce();
  });

  it('is a no-op when no buses are injected', () => {
    expect(() => makeService(undefined, undefined, undefined).onModuleDestroy()).not.toThrow();
  });
});
