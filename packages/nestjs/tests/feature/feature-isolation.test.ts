/**
 * Tests for VP-007 Phase 3: VytchesDDDModule.forFeature() per-context CQRS bus isolation.
 *
 * Coverage:
 * - VytchesDDDFeatureModule.forFeature() module structure
 * - VytchesExplorerService.claimHandlerTypes() + onApplicationBootstrap()
 * - FeatureHandlerRegistrar handler discovery and registration
 * - Cross-context isolation (the core production bug scenario from ADR-0034)
 */
import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { LOCAL_EVENT_BUS, FEATURE_ANCHOR_INJECTION } from '../../src/constants';
import { VytchesDDDFeatureModule } from '../../src/feature/vytches-ddd-feature.module';
import { FeatureHandlerRegistrar } from '../../src/feature/feature-handler-registrar';
import { VytchesExplorerService } from '../../src/services/vytches-explorer.service';

// ─── Shared mocks (hoisted so they are available to vi.mock factories) ─────────

const { MockICommandBus, MockIQueryBus } = vi.hoisted(() => {
  abstract class MockICommandBus {
    abstract register(commandType: unknown, handler: unknown): void;
    abstract registerFactory(commandType: unknown, factory: unknown): void;
    abstract execute(command: unknown): Promise<unknown>;
  }

  abstract class MockIQueryBus {
    abstract register(queryType: unknown, handler: unknown): void;
    abstract registerFactory(queryType: unknown, factory: unknown): void;
    abstract execute(query: unknown): Promise<unknown>;
  }

  return { MockICommandBus, MockIQueryBus };
});

vi.mock('@vytches/ddd-cqrs', () => {
  const makeCommandBus = vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    registerFactory: vi.fn(),
    execute: vi.fn(),
  }));
  const makeQueryBus = vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    registerFactory: vi.fn(),
    execute: vi.fn(),
  }));
  return {
    ICommandBus: MockICommandBus,
    IQueryBus: MockIQueryBus,
    CommandBus: makeCommandBus,
    QueryBus: makeQueryBus,
  };
});

vi.mock('@vytches/ddd-events', () => ({
  UnifiedEventBus: vi.fn().mockImplementation(() => ({
    publish: vi.fn(),
    subscribe: vi.fn(),
    registerHandler: vi.fn(),
  })),
}));

vi.mock('@vytches/ddd-logging', () => ({
  Logger: {
    forContext: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function makeHandlerInfo(messageType: Function) {
  return {
    type: 'command' as const,
    messageType,
    handlerType: class {},
    metadata: {},
  };
}

// ─── VytchesDDDFeatureModule.forFeature() ─────────────────────────────────────

describe('VytchesDDDFeatureModule.forFeature()', () => {
  it('returns a DynamicModule', () => {
    const mod = VytchesDDDFeatureModule.forFeature('orders');
    expect(mod).toBeDefined();
    expect(mod.module).toBe(VytchesDDDFeatureModule);
  });

  it('exports ICommandBus, IQueryBus, and LOCAL_EVENT_BUS', () => {
    const mod = VytchesDDDFeatureModule.forFeature('orders');

    // MockICommandBus / MockIQueryBus are the mocked token classes from vi.mock
    expect(mod.exports).toContain(MockICommandBus);
    expect(mod.exports).toContain(MockIQueryBus);
    expect(mod.exports).toContain(LOCAL_EVENT_BUS);
  });

  it('includes FeatureHandlerRegistrar in providers', () => {
    const mod = VytchesDDDFeatureModule.forFeature('orders');
    const providers = mod.providers as unknown[];
    expect(providers).toContain(FeatureHandlerRegistrar);
  });

  it('provides the unique anchor token for self-identification', () => {
    const mod = VytchesDDDFeatureModule.forFeature('orders');
    const providers = mod.providers as Array<{ provide?: unknown; useValue?: unknown }>;

    const anchorInjectionProvider = providers.find(p => p.provide === FEATURE_ANCHOR_INJECTION);
    expect(anchorInjectionProvider).toBeDefined();

    const anchorToken = anchorInjectionProvider!.useValue;
    expect(typeof anchorToken).toBe('symbol');
    expect(String(anchorToken)).toContain('orders');
  });

  it('provides LOCAL_EVENT_BUS via useFactory', () => {
    const mod = VytchesDDDFeatureModule.forFeature('orders');
    const providers = mod.providers as Array<{ provide?: unknown; useFactory?: unknown }>;

    const localEventBusProvider = providers.find(p => p.provide === LOCAL_EVENT_BUS);
    expect(localEventBusProvider).toBeDefined();
    expect(typeof localEventBusProvider!.useFactory).toBe('function');
  });

  it('creates a unique anchor symbol per call — same context name', () => {
    const mod1 = VytchesDDDFeatureModule.forFeature('orders');
    const mod2 = VytchesDDDFeatureModule.forFeature('orders');

    const providers1 = mod1.providers as Array<{ provide?: unknown; useValue?: unknown }>;
    const providers2 = mod2.providers as Array<{ provide?: unknown; useValue?: unknown }>;

    const anchor1 = providers1.find(p => p.provide === FEATURE_ANCHOR_INJECTION)!.useValue;
    const anchor2 = providers2.find(p => p.provide === FEATURE_ANCHOR_INJECTION)!.useValue;

    // Each call creates a new unique Symbol (not Symbol.for)
    expect(anchor1).not.toBe(anchor2);
    expect(typeof anchor1).toBe('symbol');
    expect(typeof anchor2).toBe('symbol');
  });

  it('creates different anchor symbols for different context names', () => {
    const mod1 = VytchesDDDFeatureModule.forFeature('orders');
    const mod2 = VytchesDDDFeatureModule.forFeature('catalog');

    const providers1 = mod1.providers as Array<{ provide?: unknown; useValue?: unknown }>;
    const providers2 = mod2.providers as Array<{ provide?: unknown; useValue?: unknown }>;

    const anchor1 = providers1.find(p => p.provide === FEATURE_ANCHOR_INJECTION)!.useValue;
    const anchor2 = providers2.find(p => p.provide === FEATURE_ANCHOR_INJECTION)!.useValue;

    expect(anchor1).not.toBe(anchor2);
  });

  it('throws when contextName is empty', () => {
    expect(() => VytchesDDDFeatureModule.forFeature('')).toThrow(
      'VytchesDDDModule.forFeature(): contextName cannot be empty'
    );
  });

  it('throws when contextName is whitespace-only', () => {
    expect(() => VytchesDDDFeatureModule.forFeature('   ')).toThrow(
      'VytchesDDDModule.forFeature(): contextName cannot be empty'
    );
  });
});

// ─── VytchesExplorerService — claimHandlerTypes + onApplicationBootstrap ───────

describe('VytchesExplorerService (Phase 3 additions)', () => {
  let commandBusMock: {
    register: ReturnType<typeof vi.fn>;
    registerFactory: ReturnType<typeof vi.fn>;
  };
  let service: VytchesExplorerService;

  class CommandA {}
  class CommandB {}
  class CommandC {}

  beforeEach(() => {
    commandBusMock = { register: vi.fn(), registerFactory: vi.fn() };

    // Direct instantiation — avoids NestJS DI setup complexity for pure unit tests
    service = new VytchesExplorerService(
      { get: vi.fn() } as never,
      { getProviders: vi.fn().mockReturnValue([]) } as never,
      commandBusMock as never,
      { register: vi.fn(), registerFactory: vi.fn() } as never,
      undefined,
      undefined
    );
  });

  it('claimHandlerTypes() adds message types to the claimed set', () => {
    service.claimHandlerTypes([CommandA, CommandB]);

    // discoveredHandlers is empty, so nothing registered — just verifying
    // claimHandlerTypes does not throw and returns void
    expect(() => service.claimHandlerTypes([CommandC])).not.toThrow();
  });

  it('onApplicationBootstrap() registers unclaimed handlers', async () => {
    // Directly set discoveredHandlers via access to private field
    const handlers = [makeHandlerInfo(CommandA), makeHandlerInfo(CommandB)];
    (service as unknown as { discoveredHandlers: unknown[] }).discoveredHandlers = handlers;

    await service.onApplicationBootstrap();

    // Both handlers are unclaimed → both should be registered
    expect(commandBusMock.registerFactory).toHaveBeenCalledTimes(2);
  });

  it('onApplicationBootstrap() skips claimed message types', async () => {
    const handlers = [makeHandlerInfo(CommandA), makeHandlerInfo(CommandB)];
    (service as unknown as { discoveredHandlers: unknown[] }).discoveredHandlers = handlers;

    // Claim CommandA — only CommandB should be registered
    service.claimHandlerTypes([CommandA]);

    await service.onApplicationBootstrap();

    expect(commandBusMock.registerFactory).toHaveBeenCalledTimes(1);
  });

  it('onApplicationBootstrap() skips all when all handlers are claimed', async () => {
    const handlers = [makeHandlerInfo(CommandA), makeHandlerInfo(CommandB)];
    (service as unknown as { discoveredHandlers: unknown[] }).discoveredHandlers = handlers;

    service.claimHandlerTypes([CommandA, CommandB]);

    await service.onApplicationBootstrap();

    expect(commandBusMock.registerFactory).not.toHaveBeenCalled();
  });

  it('onApplicationBootstrap() registers all when none are claimed', async () => {
    const handlers = [
      makeHandlerInfo(CommandA),
      makeHandlerInfo(CommandB),
      makeHandlerInfo(CommandC),
    ];
    (service as unknown as { discoveredHandlers: unknown[] }).discoveredHandlers = handlers;

    await service.onApplicationBootstrap();

    expect(commandBusMock.registerFactory).toHaveBeenCalledTimes(3);
  });

  it('claimHandlerTypes() is idempotent — claiming same type twice has no effect', async () => {
    const handlers = [makeHandlerInfo(CommandA)];
    (service as unknown as { discoveredHandlers: unknown[] }).discoveredHandlers = handlers;

    service.claimHandlerTypes([CommandA]);
    service.claimHandlerTypes([CommandA]); // second claim — should not matter

    await service.onApplicationBootstrap();

    expect(commandBusMock.registerFactory).not.toHaveBeenCalled();
  });
});

// ─── FeatureHandlerRegistrar unit tests ─────────────────────────────────────

describe('FeatureHandlerRegistrar', () => {
  const anchorToken = Symbol('test:feature:orders');

  class OrderCommand {}
  class OrderHandler {
    execute = vi.fn();
  }

  function makeProvider(metatype: unknown, extra?: Record<string, unknown>) {
    return { metatype, instance: new (metatype as new () => unknown)(), ...extra };
  }

  it('does not throw when own module is not found in ModulesContainer', async () => {
    const emptyContainer = new Map();
    const registrar = new FeatureHandlerRegistrar(
      { execute: vi.fn() } as unknown as never,
      { execute: vi.fn() } as unknown as never,
      { publish: vi.fn() } as unknown as never,
      anchorToken,
      { get: vi.fn() } as unknown as never,
      emptyContainer as unknown as never,
      undefined
    );

    await expect(registrar.onModuleInit()).resolves.not.toThrow();
  });

  it('registers command handlers in the local command bus', async () => {
    // Decorate OrderHandler so it has the right metadata
    Reflect.defineMetadata('di:handler-type', 'command', OrderHandler);
    Reflect.defineMetadata('di:handler-metadata', { messageType: OrderCommand }, OrderHandler);
    Reflect.defineMetadata('di:handler-scope', 'context', OrderHandler);

    const handlerInstance = new OrderHandler();
    const registerFactory = vi.fn();

    const mockCommandBus = { registerFactory };
    const mockQueryBus = { registerFactory: vi.fn() };
    const mockEventBus = { registerHandler: vi.fn() };
    const mockExplorerService = { claimHandlerTypes: vi.fn() };
    const mockModuleRef = { get: vi.fn().mockReturnValue(handlerInstance) };

    // Build a fake modules container with one module that owns the anchor token
    const fakeModule = {
      providers: new Map<unknown, { metatype: unknown }>([
        [anchorToken, { metatype: null }],
        [OrderHandler, { metatype: OrderHandler }],
      ]),
    };
    const mockContainer = new Map([['orders-hash', fakeModule]]);

    const registrar = new FeatureHandlerRegistrar(
      mockCommandBus as unknown as never,
      mockQueryBus as unknown as never,
      mockEventBus as unknown as never,
      anchorToken,
      mockModuleRef as unknown as never,
      mockContainer as unknown as never,
      mockExplorerService as unknown as never
    );

    await registrar.onModuleInit();

    expect(registerFactory).toHaveBeenCalledWith(OrderCommand, expect.any(Function));
    expect(mockExplorerService.claimHandlerTypes).toHaveBeenCalledWith([OrderCommand]);
  });

  it('skips handlers with scope "global"', async () => {
    class GlobalHandler {
      execute = vi.fn();
    }
    class GlobalCommand {}

    Reflect.defineMetadata('di:handler-type', 'command', GlobalHandler);
    Reflect.defineMetadata('di:handler-metadata', { messageType: GlobalCommand }, GlobalHandler);
    Reflect.defineMetadata('di:handler-scope', 'global', GlobalHandler);

    const registerFactory = vi.fn();
    const mockCommandBus = { registerFactory };

    const fakeModule = {
      providers: new Map<unknown, { metatype: unknown }>([
        [anchorToken, { metatype: null }],
        [GlobalHandler, { metatype: GlobalHandler }],
      ]),
    };
    const mockContainer = new Map([['hash', fakeModule]]);

    const registrar = new FeatureHandlerRegistrar(
      mockCommandBus as unknown as never,
      { registerFactory: vi.fn() } as unknown as never,
      { registerHandler: vi.fn() } as unknown as never,
      anchorToken,
      { get: vi.fn() } as unknown as never,
      mockContainer as unknown as never,
      undefined
    );

    await registrar.onModuleInit();

    expect(registerFactory).not.toHaveBeenCalled();
  });

  it('registers query handlers in the local query bus', async () => {
    class GetOrderQuery {}
    class GetOrderHandler {
      execute = vi.fn();
    }

    Reflect.defineMetadata('di:handler-type', 'query', GetOrderHandler);
    Reflect.defineMetadata('di:handler-metadata', { messageType: GetOrderQuery }, GetOrderHandler);
    Reflect.defineMetadata('di:handler-scope', 'context', GetOrderHandler);

    const queryRegisterFactory = vi.fn();
    const commandRegisterFactory = vi.fn();

    const fakeModule = {
      providers: new Map<unknown, { metatype: unknown }>([
        [anchorToken, { metatype: null }],
        [GetOrderHandler, { metatype: GetOrderHandler }],
      ]),
    };
    const mockContainer = new Map([['hash', fakeModule]]);

    const registrar = new FeatureHandlerRegistrar(
      { registerFactory: commandRegisterFactory } as unknown as never,
      { registerFactory: queryRegisterFactory } as unknown as never,
      { registerHandler: vi.fn() } as unknown as never,
      anchorToken,
      { get: vi.fn().mockReturnValue(new GetOrderHandler()) } as unknown as never,
      mockContainer as unknown as never,
      undefined
    );

    await registrar.onModuleInit();

    expect(queryRegisterFactory).toHaveBeenCalledWith(GetOrderQuery, expect.any(Function));
    expect(commandRegisterFactory).not.toHaveBeenCalled();
  });

  it('registers event handlers in the local event bus', async () => {
    class OrderPlacedEvent {}
    class OrderPlacedHandler {
      handle = vi.fn();
    }

    Reflect.defineMetadata('di:handler-type', 'event', OrderPlacedHandler);
    Reflect.defineMetadata(
      'di:handler-metadata',
      { messageType: OrderPlacedEvent },
      OrderPlacedHandler
    );
    Reflect.defineMetadata('di:handler-scope', 'context', OrderPlacedHandler);

    const eventRegisterHandler = vi.fn();
    const handlerInstance = new OrderPlacedHandler();

    const fakeModule = {
      providers: new Map<unknown, { metatype: unknown }>([
        [anchorToken, { metatype: null }],
        [OrderPlacedHandler, { metatype: OrderPlacedHandler }],
      ]),
    };
    const mockContainer = new Map([['hash', fakeModule]]);

    const registrar = new FeatureHandlerRegistrar(
      { registerFactory: vi.fn() } as unknown as never,
      { registerFactory: vi.fn() } as unknown as never,
      { registerHandler: eventRegisterHandler } as unknown as never,
      anchorToken,
      { get: vi.fn().mockReturnValue(handlerInstance) } as unknown as never,
      mockContainer as unknown as never,
      undefined
    );

    await registrar.onModuleInit();

    expect(eventRegisterHandler).toHaveBeenCalledWith(OrderPlacedEvent, handlerInstance);
  });

  it('only scans providers from its OWN module — not other modules', async () => {
    class OrderCommand {}
    class OrderHandler {
      execute = vi.fn();
    }
    class CatalogCommand {}
    class CatalogHandler {
      execute = vi.fn();
    }

    Reflect.defineMetadata('di:handler-type', 'command', OrderHandler);
    Reflect.defineMetadata('di:handler-metadata', { messageType: OrderCommand }, OrderHandler);
    Reflect.defineMetadata('di:handler-scope', 'context', OrderHandler);

    Reflect.defineMetadata('di:handler-type', 'command', CatalogHandler);
    Reflect.defineMetadata('di:handler-metadata', { messageType: CatalogCommand }, CatalogHandler);
    Reflect.defineMetadata('di:handler-scope', 'context', CatalogHandler);

    const orderAnchor = Symbol('test:feature:orders-own');
    const catalogAnchor = Symbol('test:feature:catalog-other');

    const ordersModule = {
      providers: new Map<unknown, { metatype: unknown }>([
        [orderAnchor, { metatype: null }],
        [OrderHandler, { metatype: OrderHandler }],
      ]),
    };
    const catalogModule = {
      providers: new Map<unknown, { metatype: unknown }>([
        [catalogAnchor, { metatype: null }],
        [CatalogHandler, { metatype: CatalogHandler }],
      ]),
    };

    const mockContainer = new Map([
      ['orders-hash', ordersModule],
      ['catalog-hash', catalogModule],
    ]);

    const registerFactory = vi.fn();

    const registrar = new FeatureHandlerRegistrar(
      { registerFactory } as unknown as never,
      { registerFactory: vi.fn() } as unknown as never,
      { registerHandler: vi.fn() } as unknown as never,
      orderAnchor, // registrar belongs to orders module
      { get: vi.fn().mockReturnValue(new OrderHandler()) } as unknown as never,
      mockContainer as unknown as never,
      undefined
    );

    await registrar.onModuleInit();

    // Only OrderCommand should be registered — not CatalogCommand
    expect(registerFactory).toHaveBeenCalledTimes(1);
    expect(registerFactory).toHaveBeenCalledWith(OrderCommand, expect.any(Function));
    expect(registerFactory).not.toHaveBeenCalledWith(CatalogCommand, expect.any(Function));
  });
});

// ─── Cross-context isolation scenario (core ADR-0034 bug) ─────────────────────

describe('cross-context isolation — ADR-0034 production bug scenario', () => {
  it('two feature modules with identical command names route to correct handlers', async () => {
    // Both contexts define a class named "UpdateReadModelCommand" — different constructor refs
    class UpdateReadModelCommand {
      constructor(public contextA = true) {}
    }
    const CatalogUpdateReadModelCommand = class UpdateReadModelCommand {
      constructor(public catalog = true) {}
    };

    const ordersRegisterFactory = vi.fn();
    const catalogRegisterFactory = vi.fn();
    const claimSpy = vi.fn();

    const ordersAnchor = Symbol('test:feature:orders-iso');
    const catalogAnchor = Symbol('test:feature:catalog-iso');

    // --- Handlers ---
    class OrdersUpdateHandler {
      execute = vi.fn();
    }
    class CatalogUpdateHandler {
      execute = vi.fn();
    }

    Reflect.defineMetadata('di:handler-type', 'command', OrdersUpdateHandler);
    Reflect.defineMetadata(
      'di:handler-metadata',
      { messageType: UpdateReadModelCommand },
      OrdersUpdateHandler
    );
    Reflect.defineMetadata('di:handler-scope', 'context', OrdersUpdateHandler);

    Reflect.defineMetadata('di:handler-type', 'command', CatalogUpdateHandler);
    Reflect.defineMetadata(
      'di:handler-metadata',
      { messageType: CatalogUpdateReadModelCommand },
      CatalogUpdateHandler
    );
    Reflect.defineMetadata('di:handler-scope', 'context', CatalogUpdateHandler);

    // --- Modules in container ---
    const ordersModule = {
      providers: new Map<unknown, { metatype: unknown }>([
        [ordersAnchor, { metatype: null }],
        [OrdersUpdateHandler, { metatype: OrdersUpdateHandler }],
      ]),
    };
    const catalogModule = {
      providers: new Map<unknown, { metatype: unknown }>([
        [catalogAnchor, { metatype: null }],
        [CatalogUpdateHandler, { metatype: CatalogUpdateHandler }],
      ]),
    };
    const mockContainer = new Map([
      ['orders-hash', ordersModule],
      ['catalog-hash', catalogModule],
    ]);

    const mockExplorer = { claimHandlerTypes: claimSpy };

    // --- Orders registrar ---
    const ordersRegistrar = new FeatureHandlerRegistrar(
      { registerFactory: ordersRegisterFactory } as unknown as never,
      { registerFactory: vi.fn() } as unknown as never,
      { registerHandler: vi.fn() } as unknown as never,
      ordersAnchor,
      { get: vi.fn().mockReturnValue(new OrdersUpdateHandler()) } as unknown as never,
      mockContainer as unknown as never,
      mockExplorer as unknown as never
    );

    // --- Catalog registrar ---
    const catalogRegistrar = new FeatureHandlerRegistrar(
      { registerFactory: catalogRegisterFactory } as unknown as never,
      { registerFactory: vi.fn() } as unknown as never,
      { registerHandler: vi.fn() } as unknown as never,
      catalogAnchor,
      { get: vi.fn().mockReturnValue(new CatalogUpdateHandler()) } as unknown as never,
      mockContainer as unknown as never,
      mockExplorer as unknown as never
    );

    await ordersRegistrar.onModuleInit();
    await catalogRegistrar.onModuleInit();

    // Each registrar registered its own command type in its own bus
    expect(ordersRegisterFactory).toHaveBeenCalledWith(
      UpdateReadModelCommand,
      expect.any(Function)
    );
    expect(catalogRegisterFactory).toHaveBeenCalledWith(
      CatalogUpdateReadModelCommand,
      expect.any(Function)
    );

    // Despite sharing the same class NAME, the two commands are different constructor refs
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const [ordersMsg] = ordersRegisterFactory.mock.calls[0] as [Function, unknown];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const [catalogMsg] = catalogRegisterFactory.mock.calls[0] as [Function, unknown];
    expect(ordersMsg).not.toBe(catalogMsg);

    // Both message types were claimed with the explorer service
    expect(claimSpy).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const claimedBatch1 = claimSpy.mock.calls[0]?.[0] as Function[];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const claimedBatch2 = claimSpy.mock.calls[1]?.[0] as Function[];
    expect([...claimedBatch1, ...claimedBatch2]).toContain(UpdateReadModelCommand);
    expect([...claimedBatch1, ...claimedBatch2]).toContain(CatalogUpdateReadModelCommand);
  });
});
