/**
 * Tests for VP-009 Bug #1 — FeatureHandlerRegistrar.findOwnModule() fix.
 *
 * Bug: findOwnModule() returns the VytchesDDDFeatureModule (the one that
 * owns the anchorToken in its providers), but handlers live in the importing
 * consumer module. extractHandlers() therefore finds 0 handlers and the
 * feature bus stays empty.
 *
 * Fix (Variant A): locate the featureModule via anchorToken, then traverse
 * modulesContainer looking for the consumer module M such that
 * M.imports.has(featureModule). Return M — its providers contain the handlers.
 */
import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';

import { FeatureHandlerRegistrar } from '../../src/feature/feature-handler-registrar';
import { internalLogger } from '@vytches/ddd-contracts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal NestJS Module shape used by findOwnModule() traversal */
function makeModule(opts: {
  providers?: Map<unknown, { metatype: unknown }>;
  imports?: Set<unknown>;
}) {
  return {
    providers: opts.providers ?? new Map(),
    imports: opts.imports ?? new Set(),
  };
}

// ─── Bug #1 — findOwnModule() must return the consumer module, not the feature module ──

describe('FeatureHandlerRegistrar — Bug #1: findOwnModule() Variant A', () => {
  class PlaceOrderCommand {}
  class PlaceOrderHandler {
    execute = vi.fn();
  }

  const anchorToken = Symbol('vytches:feature:orders');

  beforeEach(() => {
    Reflect.defineMetadata('di:handler-type', 'command', PlaceOrderHandler);
    Reflect.defineMetadata(
      'di:handler-metadata',
      { messageType: PlaceOrderCommand },
      PlaceOrderHandler
    );
    Reflect.defineMetadata('di:handler-scope', 'context', PlaceOrderHandler);
  });

  it('RED — handler in consumer module stays unregistered when findOwnModule() returns feature module', async () => {
    // This test simulates the bug: featureModule has anchorToken but zero handlers;
    // consumer module (OrdersModule) has the handler but findOwnModule() does NOT
    // look at imports — so the handler is never found.

    // Feature module — owns the anchor (as forFeature() registers it there)
    const featureModule = makeModule({
      providers: new Map([[anchorToken, { metatype: null }]]),
    });

    // Consumer module — owns the handler; imports the featureModule
    const consumerModule = makeModule({
      providers: new Map([[PlaceOrderHandler, { metatype: PlaceOrderHandler }]]),
      imports: new Set([featureModule]),
    });

    const mockContainer = new Map([
      ['feature-hash', featureModule],
      ['consumer-hash', consumerModule],
    ]);

    const registerFactory = vi.fn();

    const registrar = new FeatureHandlerRegistrar(
      { registerFactory } as unknown as never,
      { registerFactory: vi.fn() } as unknown as never,
      { registerHandler: vi.fn() } as unknown as never,
      anchorToken,
      { get: vi.fn().mockReturnValue(new PlaceOrderHandler()) } as unknown as never,
      mockContainer as unknown as never,
      undefined
    );

    await registrar.onModuleInit();

    // After Bug #1 fix: handler IS registered.
    // In RED state (before fix): registerFactory is NOT called because
    // findOwnModule() returned featureModule (0 handlers) instead of consumerModule.
    expect(registerFactory).toHaveBeenCalledWith(PlaceOrderCommand, expect.any(Function));
  });

  it('graceful warn (no crash) when no module imports the feature module', async () => {
    // Edge case: forFeature() used but nobody imports the resulting module.
    // Should warn via internalLogger.warn and return without throwing.

    const featureModule = makeModule({
      providers: new Map([[anchorToken, { metatype: null }]]),
    });

    // No consumer — featureModule is in the container but nobody imports it
    const mockContainer = new Map([['feature-hash', featureModule]]);

    const warnSpy = vi.spyOn(internalLogger, 'warn').mockImplementation(() => undefined);

    const registrar = new FeatureHandlerRegistrar(
      { registerFactory: vi.fn() } as unknown as never,
      { registerFactory: vi.fn() } as unknown as never,
      { registerHandler: vi.fn() } as unknown as never,
      anchorToken,
      { get: vi.fn() } as unknown as never,
      mockContainer as unknown as never,
      undefined
    );

    await expect(registrar.onModuleInit()).resolves.not.toThrow();

    // Should have warned about not finding own module
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('with fix: consumer module handlers are registered in feature bus', async () => {
    // Full Variant A scenario: featureModule (has anchor) → find consumer M
    // where M.imports.has(featureModule) → scan M.providers for handlers.

    const featureModule = makeModule({
      providers: new Map([[anchorToken, { metatype: null }]]),
    });

    const consumerModule = makeModule({
      providers: new Map([[PlaceOrderHandler, { metatype: PlaceOrderHandler }]]),
      imports: new Set([featureModule]),
    });

    const otherModule = makeModule({
      providers: new Map(),
    });

    const mockContainer = new Map([
      ['feature-hash', featureModule],
      ['consumer-hash', consumerModule],
      ['other-hash', otherModule],
    ]);

    const registerFactory = vi.fn();
    const explorerService = { claimHandlerTypes: vi.fn() };

    const registrar = new FeatureHandlerRegistrar(
      { registerFactory } as unknown as never,
      { registerFactory: vi.fn() } as unknown as never,
      { registerHandler: vi.fn() } as unknown as never,
      anchorToken,
      { get: vi.fn().mockReturnValue(new PlaceOrderHandler()) } as unknown as never,
      mockContainer as unknown as never,
      explorerService as unknown as never
    );

    await registrar.onModuleInit();

    expect(registerFactory).toHaveBeenCalledTimes(1);
    expect(registerFactory).toHaveBeenCalledWith(PlaceOrderCommand, expect.any(Function));
    expect(explorerService.claimHandlerTypes).toHaveBeenCalledWith([PlaceOrderCommand]);
  });

  it('does not scan providers of unrelated modules', async () => {
    class CatalogCommand {}
    class CatalogHandler {
      execute = vi.fn();
    }

    Reflect.defineMetadata('di:handler-type', 'command', CatalogHandler);
    Reflect.defineMetadata('di:handler-metadata', { messageType: CatalogCommand }, CatalogHandler);
    Reflect.defineMetadata('di:handler-scope', 'context', CatalogHandler);

    const featureModule = makeModule({
      providers: new Map([[anchorToken, { metatype: null }]]),
    });

    const consumerModule = makeModule({
      providers: new Map([[PlaceOrderHandler, { metatype: PlaceOrderHandler }]]),
      imports: new Set([featureModule]),
    });

    // Unrelated catalog module — does NOT import featureModule
    const catalogModule = makeModule({
      providers: new Map([[CatalogHandler, { metatype: CatalogHandler }]]),
    });

    const mockContainer = new Map([
      ['feature-hash', featureModule],
      ['consumer-hash', consumerModule],
      ['catalog-hash', catalogModule],
    ]);

    const registerFactory = vi.fn();

    const registrar = new FeatureHandlerRegistrar(
      { registerFactory } as unknown as never,
      { registerFactory: vi.fn() } as unknown as never,
      { registerHandler: vi.fn() } as unknown as never,
      anchorToken,
      { get: vi.fn().mockReturnValue(new PlaceOrderHandler()) } as unknown as never,
      mockContainer as unknown as never,
      undefined
    );

    await registrar.onModuleInit();

    // Only PlaceOrderCommand from consumerModule — CatalogCommand is NOT registered
    expect(registerFactory).toHaveBeenCalledTimes(1);
    expect(registerFactory).toHaveBeenCalledWith(PlaceOrderCommand, expect.any(Function));
    expect(registerFactory).not.toHaveBeenCalledWith(CatalogCommand, expect.any(Function));
  });
});
