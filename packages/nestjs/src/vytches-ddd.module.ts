import type { DynamicModule, ModuleMetadata, Provider } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService, ModuleRef } from '@nestjs/core';
// eslint-disable-next-line @nx/enforce-module-boundaries -- Required for DI tokens in forTesting()
import { ICommandBus, IQueryBus, COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@vytches/ddd-cqrs';
import { IEventBus } from '@vytches/ddd-contracts';
import { VytchesExplorerService } from './services/vytches-explorer.service';
import { VytchesDDDFeatureModule } from './feature/vytches-ddd-feature.module';
import type { VytchesContextOptions, VytchesDDDModuleOptions } from './types';

/**
 * VytchesDDD NestJS Integration Module
 * Simple DI integration following @nestjs/cqrs patterns
 *
 * Key Features:
 * - Automatic handler discovery using NestJS DiscoveryService
 * - Direct registration with CQRS buses (ICommandBus, IQueryBus)
 * - Context-based handler isolation
 * - Production-ready default configurations
 *
 * @example
 * // Basic configuration - buses auto-injected if provided
 * VytchesDDDModule.forRoot()
 *
 * @example
 * // With CQRS buses in providers. Prefer useFactory over useValue so each
 * // module owns its bus instance — a useValue bus is a process-global
 * // singleton whose handler registrations outlive the module, leaking stale
 * // handler factories across sequentially-created modules (e.g. tests).
 * @Module({
 *   imports: [VytchesDDDModule.forRoot()],
 *   providers: [
 *     { provide: ICommandBus, useFactory: () => new EnhancedCommandBus(container) },
 *     { provide: IQueryBus, useFactory: () => new EnhancedQueryBus(container) },
 *   ],
 * })
 */
@Global()
@Module({})
export class VytchesDDDModule {
  static forRoot(options: VytchesDDDModuleOptions = {}): DynamicModule {
    // Bridge: when a consumer provides buses under class tokens (ICommandBus /
    // IQueryBus), these aliases expose them under the stable Symbol tokens that
    // VytchesExplorerService injects via @Inject(COMMAND_BUS_TOKEN) /
    // @Inject(QUERY_BUS_TOKEN).
    //
    // useFactory with optional inject instead of useExisting: NestJS throws a
    // compile-time DI error for useExisting when the target token is absent,
    // even if the downstream consumer has @Optional. useFactory returns
    // undefined when the class token is not registered, which @Optional handles
    // correctly (graceful degradation — module boots without a bus).
    const bridgeProviders: Provider[] = [
      {
        provide: COMMAND_BUS_TOKEN,
        useFactory: (bus?: ICommandBus) => bus,
        inject: [{ token: ICommandBus, optional: true }],
      },
      {
        provide: QUERY_BUS_TOKEN,
        useFactory: (bus?: IQueryBus) => bus,
        inject: [{ token: IQueryBus, optional: true }],
      },
    ];

    const providers: Provider[] = [
      VytchesExplorerService,
      ...bridgeProviders,
      ...(options.providers || []),
    ];

    return {
      module: VytchesDDDModule,
      imports: [DiscoveryModule, ...(options.imports || [])],
      providers,
      exports: [VytchesExplorerService],
      global: options.isGlobal !== false,
    };
  }

  static forRootAsync(options: {
    imports?: ModuleMetadata['imports'];
    useFactory?: (...args: unknown[]) => Promise<VytchesDDDModuleOptions> | VytchesDDDModuleOptions;
    inject?: Array<string | symbol | unknown>;
  }): DynamicModule {
    return {
      module: VytchesDDDModule,
      imports: [DiscoveryModule, ...(options.imports || [])],
      providers: [
        VytchesExplorerService,
        {
          provide: COMMAND_BUS_TOKEN,
          useFactory: (bus?: ICommandBus) => bus,
          inject: [{ token: ICommandBus, optional: true }],
        },
        {
          provide: QUERY_BUS_TOKEN,
          useFactory: (bus?: IQueryBus) => bus,
          inject: [{ token: IQueryBus, optional: true }],
        },
      ],
      exports: [VytchesExplorerService],
      global: true,
    };
  }

  static forContext(
    context: string,
    options: VytchesDDDModuleOptions & { context?: VytchesContextOptions } = {}
  ): DynamicModule {
    if (!context || context.trim() === '') {
      throw new Error('Context name cannot be null or empty');
    }

    const contextServiceName = `VytchesExplorerService_${context}`;

    const providers: Provider[] = [
      VytchesExplorerService,
      {
        provide: contextServiceName,
        useFactory: (moduleRef: ModuleRef, discoveryService: DiscoveryService) => {
          const explorer = new VytchesExplorerService(moduleRef, discoveryService);
          (explorer as unknown as { contextConfig: unknown }).contextConfig = {
            context,
            ...options,
          };
          return explorer;
        },
        inject: [ModuleRef, DiscoveryService],
      },
      ...(options.providers || []),
    ];

    return {
      module: VytchesDDDModule,
      imports: [DiscoveryModule, ...(options.imports || [])],
      providers,
      exports: [VytchesExplorerService, contextServiceName],
      global: options.isGlobal !== false,
    };
  }

  static forContexts(options: VytchesDDDModuleOptions = {}): DynamicModule {
    if (!options.contexts || typeof options.contexts !== 'object') {
      return VytchesDDDModule.forRoot(options);
    }

    const ctxNames = Array.isArray(options.contexts)
      ? options.contexts
      : Object.keys(options.contexts);

    const contextProviders: Provider[] = [];
    const contextExports: string[] = [];

    for (const contextName of ctxNames) {
      const contextConfig = Array.isArray(options.contexts)
        ? {}
        : options.contexts[contextName] || {};

      const contextServiceName = `VytchesExplorerService_${contextName}`;

      contextProviders.push({
        provide: contextServiceName,
        useFactory: (moduleRef: ModuleRef, discoveryService: DiscoveryService) => {
          const explorer = new VytchesExplorerService(moduleRef, discoveryService);
          (explorer as unknown as { contextConfig: unknown }).contextConfig = {
            context: contextName,
            ...contextConfig,
          };
          return explorer;
        },
        inject: [ModuleRef, DiscoveryService],
      });

      contextExports.push(contextServiceName);
    }

    const providers: Provider[] = [
      VytchesExplorerService,
      ...contextProviders,
      ...(options.providers || []),
    ];

    return {
      module: VytchesDDDModule,
      imports: [DiscoveryModule, ...(options.imports || [])],
      providers,
      exports: [VytchesExplorerService, ...contextExports],
      global: options.isGlobal !== false,
    };
  }

  /**
   * Creates an isolated CQRS environment for one bounded context.
   *
   * Each bounded-context NestJS module should import this once. It provides
   * context-scoped `ICommandBus`, `IQueryBus`, and `LOCAL_EVENT_BUS` instances
   * that override the global buses for handlers within that module.
   *
   * `FeatureHandlerRegistrar` automatically discovers handlers decorated with
   * `@CommandHandler` / `@QueryHandler` / `@EventHandler` in the importing
   * module and registers them in the local buses, then claims their message types
   * so the global bus fallback does not double-register them.
   *
   * @example
   * ```typescript
   * import { VytchesDDDModule, LOCAL_EVENT_BUS } from '@vytches/ddd-nestjs';
   *
   * @Module({
   *   imports: [VytchesDDDModule.forFeature('orders')],
   *   providers: [CreateOrderHandler, GetOrderQueryHandler],
   * })
   * export class OrdersModule {}
   *
   * // In a handler — gets the context-scoped bus, not the global one:
   * @CommandHandler(PlaceOrderCommand)
   * export class PlaceOrderHandler {
   *   constructor(@Inject(ICommandBus) private bus: ICommandBus) {}
   * }
   * ```
   */
  static forFeature(contextName: string): DynamicModule {
    return VytchesDDDFeatureModule.forFeature(contextName);
  }

  static forTesting(options: VytchesDDDModuleOptions = {}): DynamicModule {
    // Stubs are defined once and registered under both the class token (ICommandBus /
    // IQueryBus) and the stable Symbol token (COMMAND_BUS_TOKEN / QUERY_BUS_TOKEN).
    // VytchesExplorerService injects via the Symbol tokens; external consumers that
    // still use the class token also get the same stub instance (Pitfall 1 fix).
    const commandBusStub = {
      register: (): void => {
        /* noop */
      },
      registerFactory: (): void => {
        /* noop */
      },
      execute: () => Promise.resolve({ success: true }),
    };

    const queryBusStub = {
      register: (): void => {
        /* noop */
      },
      registerFactory: (): void => {
        /* noop */
      },
      send: () => Promise.resolve({ success: true }),
    };

    const providers: Provider[] = [
      VytchesExplorerService,
      // Register under Symbol token — used by VytchesExplorerService constructor
      { provide: COMMAND_BUS_TOKEN, useValue: commandBusStub },
      { provide: QUERY_BUS_TOKEN, useValue: queryBusStub },
      // Alias class tokens to the Symbol-token stubs so both resolve the same object
      { provide: ICommandBus, useExisting: COMMAND_BUS_TOKEN },
      { provide: IQueryBus, useExisting: QUERY_BUS_TOKEN },
      {
        provide: IEventBus,
        useValue: {
          subscribe: (): void => {
            /* noop */
          },
          registerHandler: (): void => {
            /* noop */
          },
          publish: () => Promise.resolve(),
          publishMany: () => Promise.resolve(),
          unsubscribe: (): void => {
            /* noop */
          },
        },
      },
      ...(options.providers || []),
    ];

    return {
      module: VytchesDDDModule,
      imports: [DiscoveryModule, ...(options.imports || [])],
      providers,
      exports: [
        VytchesExplorerService,
        COMMAND_BUS_TOKEN,
        QUERY_BUS_TOKEN,
        ICommandBus,
        IQueryBus,
        IEventBus,
      ],
      global: false,
    };
  }
}
