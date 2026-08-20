import type { OnApplicationBootstrap, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { DiscoveryService, ModuleRef } from '@nestjs/core';
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import type { Constructor } from '@vytches/ddd-di';
// eslint-disable-next-line @nx/enforce-module-boundaries -- Required for DI injection tokens
import type { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
// eslint-disable-next-line @nx/enforce-module-boundaries -- Required for DI injection tokens
import { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@vytches/ddd-cqrs';
import { IEventBus } from '@vytches/ddd-contracts';
import { EVENT_HANDLER_METADATA, internalLogger } from '@vytches/ddd-contracts/internal';
import type { HandlerInfo, VytchesContextOptions, VytchesDDDModuleOptions } from '../types';
import { ACL_ADAPTER_METADATA, ACL_REGISTRY, VYTCHES_DDD_OPTIONS } from '../constants';
import type { ACLAdapterMetadata } from '../decorators/acl-adapter.decorator';
import { BusRegistrationLedger } from './bus-registration-ledger';

/**
 * Minimal interface for ACL registry — avoids hard dependency on @vytches/ddd-acl
 */
interface IACLRegistryLike {
  register(contextName: string, adapter: unknown, metadata?: unknown): unknown;
  hasContext(contextName: string): boolean;
}

// Metadata keys used by VytchesDDD decorators
const DI_HANDLER_TYPE = 'di:handler-type';
const DI_HANDLER_METADATA = 'di:handler-metadata';
const DI_COMMAND_HANDLER = 'di:command-handler';
const DI_QUERY_HANDLER = 'di:query-handler';
const DI_EVENT_HANDLER = 'di:event-handler';
const DOMAIN_SERVICE = 'domain-service';

interface HandlerMetadata {
  type: 'command' | 'query' | 'event' | 'domain-service';
  messageType: Constructor;
}

/**
 * VytchesExplorerService - Auto-discovers and registers CQRS handlers in NestJS
 *
 * This service:
 * 1. Uses NestJS DiscoveryService to find all decorated handlers
 * 2. Registers handlers directly with CQRS buses (ICommandBus, IQueryBus)
 * 3. Works automatically when buses are provided in module
 *
 * @example
 * ```typescript
 * // In your module - buses are injected automatically.
 * // Prefer useFactory over useValue: a useValue bus is a process-global
 * // singleton whose handler registrations outlive the module that created
 * // them, which leaks stale handler factories across sequentially-created
 * // modules (e.g. multiple Test.createTestingModule() calls in one process).
 * // useFactory gives each module its own bus instance, tied to its lifecycle.
 * @Module({
 *   imports: [DiscoveryModule],
 *   providers: [
 *     VytchesExplorerService,
 *     { provide: ICommandBus, useFactory: () => new EnhancedCommandBus(container) },
 *     { provide: IQueryBus, useFactory: () => new EnhancedQueryBus(container) },
 *   ],
 * })
 * export class MyModule {}
 * ```
 */
// Interface for buses with registration methods
interface BusWithRegistration {
  register?(messageType: unknown, handler: unknown): void;
  registerFactory?(messageType: unknown, factory: () => unknown): void;
  subscribe?(eventType: unknown, handler: unknown): void;
  registerHandler?(eventType: unknown, handler: unknown): void;
  reset?(): void;
  dispose?(): void;
}

@Injectable()
export class VytchesExplorerService
  implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy
{
  private _contextOptions?: VytchesContextOptions;
  private discoveredHandlers: HandlerInfo[] = [];
  private initialized = false;
  private strictHandlerRegistration = false;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- class constructor ref used as Set key for reflection
  private readonly claimedTypes = new Set<Function>();

  constructor(
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Inject(DiscoveryService) private readonly discoveryService: DiscoveryService,
    @Optional() @Inject(COMMAND_BUS_TOKEN) private readonly commandBus?: ICommandBus,
    @Optional() @Inject(QUERY_BUS_TOKEN) private readonly queryBus?: IQueryBus,
    @Optional() @Inject(IEventBus) private readonly eventBus?: IEventBus,
    @Optional() @Inject(ACL_REGISTRY) private readonly aclRegistry?: IACLRegistryLike,
    @Optional() @Inject(VYTCHES_DDD_OPTIONS) private readonly options?: VytchesDDDModuleOptions
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Warn when an injected bus is present but does not support reset().
    // Without reset() the bus cannot evict stale handler factories on module
    // teardown, so sequentially-recreated modules (e.g. in tests) will leak
    // stale closures into the next module. This is a misconfiguration, not a
    // crash — warn only (do NOT throw).
    for (const [busLabel, bus] of [
      ['commandBus', this.commandBus],
      ['queryBus', this.queryBus],
      ['eventBus', this.eventBus],
    ] as const) {
      if (
        bus !== undefined &&
        typeof (bus as unknown as BusWithRegistration).reset !== 'function'
      ) {
        internalLogger.warn(
          `VytchesExplorer: injected ${busLabel} does not implement reset() — stale handler factories will not be evicted on module destroy`,
          { busLabel, busType: bus.constructor?.name ?? 'unknown' }
        );
      }
    }

    // autoDiscovery.enabled === false opts out of the reflection scan entirely.
    // Absent options (or an absent flag) keep discovery on, matching the
    // documented default and every module built before the options token
    // existed.
    if (this.options?.autoDiscovery?.enabled === false) {
      this.discoveredHandlers = [];
      this.initialized = true;
      return;
    }

    try {
      this.discoveredHandlers = await this.discoverHandlers();
      await this.discoverAndRegisterACLAdapters();
      this.initialized = true;
    } catch (error) {
      internalLogger.error(
        'VytchesExplorer: Initialization failed',
        error instanceof Error ? error : undefined,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
      throw error;
    }
  }

  /**
   * Registers unclaimed handlers into the global buses.
   *
   * Runs after all onModuleInit() hooks complete, so FeatureHandlerRegistrar
   * instances have already claimed their context-specific handlers.
   */
  async onApplicationBootstrap(): Promise<void> {
    const unclaimed = this.discoveredHandlers.filter(h => !this.claimedTypes.has(h.messageType));
    const registered = await this.registerHandlersWithBuses(unclaimed);

    // Handlers exist, none of them reached a bus: the application will answer
    // every command and query with "No handler registered for ...". Say so once
    // with the whole picture, so the cause is visible at boot rather than
    // reconstructed from a pile of failing requests.
    if (unclaimed.length > 0 && registered === 0) {
      internalLogger.warn(
        'VytchesExplorer: handlers were discovered but none were registered — every dispatch will fail. Check that a bus is provided under COMMAND_BUS_TOKEN / QUERY_BUS_TOKEN (VytchesDDDModule.forRoot() bridges the ICommandBus / IQueryBus class tokens for you)',
        {
          discovered: this.discoveredHandlers.length,
          claimedByFeatureModules: this.discoveredHandlers.length - unclaimed.length,
          registered,
          hasCommandBus: this.commandBus !== undefined,
          hasQueryBus: this.queryBus !== undefined,
          hasEventBus: this.eventBus !== undefined,
        }
      );
    }
  }

  /**
   * Evict this module's handler registrations from the buses on teardown.
   *
   * Handlers are registered as factory closures over this service's moduleRef.
   * When a bus instance outlives the module that populated it (e.g. a process-
   * global bus shared across sequentially-created test modules), those closures
   * become stale once the module is destroyed. Resetting the bus here drops them
   * so the next module starts clean. Buses that do not support reset() (i.e. do
   * not implement IResettableBus) are skipped.
   *
   * After reset() (which evicts handlers/state), dispose() is called on buses
   * that implement IDisposableBus to release background resources — primarily
   * the cache-cleanup setInterval. reset() does not stop those timers; without
   * an explicit dispose() they accumulate across repeated create→destroy cycles
   * in one process (e.g. sequential test modules). Buses without dispose() are
   * skipped. Ordering matters: reset() clears state first, dispose() then
   * releases I/O. Both are error-tolerant — failures warn, never throw.
   */
  onModuleDestroy(): void {
    for (const bus of [this.commandBus, this.queryBus, this.eventBus]) {
      const lifecycle = bus as unknown as BusWithRegistration | undefined;
      if (lifecycle && typeof lifecycle.reset === 'function') {
        try {
          lifecycle.reset();
        } catch (error) {
          internalLogger.warn('VytchesExplorer: Failed to reset bus on module destroy', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (lifecycle && typeof lifecycle.dispose === 'function') {
        try {
          lifecycle.dispose();
        } catch (error) {
          internalLogger.warn('VytchesExplorer: Failed to dispose bus on module destroy', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  /**
   * Called by FeatureHandlerRegistrar during onModuleInit() to mark message
   * types as handled by a feature-scoped bus. The global fallback in
   * onApplicationBootstrap() skips claimed types.
   */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- class constructor refs used as reflection keys
  claimHandlerTypes(messageTypes: Function[]): void {
    for (const type of messageTypes) {
      this.claimedTypes.add(type);
    }
  }

  configureContext(options: VytchesContextOptions): void {
    this._contextOptions = options;
    if (options.strictHandlerRegistration !== undefined) {
      this.strictHandlerRegistration = options.strictHandlerRegistration;
    }
  }

  /**
   * Opt into strict handler registration. When enabled, a failure to register
   * any discovered handler aborts bootstrap (the error is rethrown from
   * onApplicationBootstrap) instead of being logged and skipped. Off by default
   * to preserve backward-compatible boot behavior.
   *
   * Call before onApplicationBootstrap() runs (e.g. in your module's
   * onModuleInit) for it to take effect on auto-discovered handlers.
   */
  setStrictHandlerRegistration(enabled = true): this {
    this.strictHandlerRegistration = enabled;
    return this;
  }

  /**
   * Get discovered handlers
   */
  getHandlers(): HandlerInfo[] {
    return this.discoveredHandlers;
  }

  /**
   * Get handlers by type
   */
  getHandlersByType(type: 'command' | 'query' | 'event' | 'domain-service'): HandlerInfo[] {
    return this.discoveredHandlers.filter(h => h.type === type);
  }

  /**
   * Manually register additional handlers with buses
   * Useful for handlers that aren't auto-discovered
   */
  async registerHandler(handler: HandlerInfo): Promise<void> {
    this.discoveredHandlers.push(handler);
    await this.registerHandlersWithBuses([handler]);
  }

  async discoverHandlers(): Promise<HandlerInfo[]> {
    const handlers: HandlerInfo[] = [];

    if (!this.discoveryService) {
      return handlers;
    }

    const providers = this.discoveryService.getProviders();
    for (const provider of providers) {
      // Class-level handler discovery (command, query, event, domain-service)
      const handlerInfo = this.extractHandlerInfo(provider);
      if (handlerInfo) {
        handlers.push(handlerInfo);
      }

      // Method-level event handler discovery
      const methodHandlers = this.extractMethodLevelEventHandlers(provider);
      handlers.push(...methodHandlers);
    }

    return handlers;
  }

  private extractHandlerInfo(provider: InstanceWrapper): HandlerInfo | null {
    try {
      const { metatype, instance } = provider;

      if (!metatype || typeof metatype !== 'function' || !instance) {
        return null;
      }

      const handlerMetadata = this.getHandlerMetadata(metatype as Constructor);
      if (handlerMetadata) {
        return {
          type: handlerMetadata.type,
          messageType: handlerMetadata.messageType,
          handlerType: metatype as Constructor,
          metadata: handlerMetadata,
        };
      }
    } catch {
      // Skip problematic providers
    }

    return null;
  }

  private extractMethodLevelEventHandlers(provider: InstanceWrapper): HandlerInfo[] {
    const handlers: HandlerInfo[] = [];

    try {
      const { metatype, instance } = provider;

      if (!metatype || typeof metatype !== 'function' || !instance) {
        return handlers;
      }

      const prototype = metatype.prototype as Record<string, unknown> | undefined;
      if (!prototype) {
        return handlers;
      }

      const methodNames = Object.getOwnPropertyNames(prototype);
      for (const methodName of methodNames) {
        if (methodName === 'constructor') continue;

        const method = prototype[methodName];
        if (typeof method !== 'function') continue;

        const metadata = Reflect.getMetadata(EVENT_HANDLER_METADATA, method);
        if (metadata?.eventName) {
          handlers.push({
            type: 'event',
            messageType: metadata.eventName as Constructor,
            handlerType: metatype as Constructor,
            metadata: { ...metadata, methodName },
          });
        }
      }
    } catch {
      // Skip problematic providers
    }

    return handlers;
  }

  private getHandlerMetadata(target: Constructor): HandlerMetadata | null {
    try {
      // DI-aware handler metadata (new pattern)
      const diHandlerType = Reflect.getMetadata(DI_HANDLER_TYPE, target);
      const diHandlerMetadata = Reflect.getMetadata(DI_HANDLER_METADATA, target);
      if (diHandlerType && diHandlerMetadata?.messageType) {
        return {
          type: diHandlerType as 'command' | 'query' | 'event' | 'domain-service',
          messageType: diHandlerMetadata.messageType,
        };
      }

      // Command handler metadata
      const commandMetadata =
        Reflect.getMetadata(DI_COMMAND_HANDLER, target) ||
        Reflect.getMetadata('command-handler', target);
      if (commandMetadata?.messageType || commandMetadata?.command) {
        return {
          type: 'command',
          messageType: commandMetadata.messageType || commandMetadata.command,
        };
      }

      // Query handler metadata
      const queryMetadata =
        Reflect.getMetadata(DI_QUERY_HANDLER, target) ||
        Reflect.getMetadata('query-handler', target);
      if (queryMetadata?.messageType || queryMetadata?.query) {
        return {
          type: 'query',
          messageType: queryMetadata.messageType || queryMetadata.query,
        };
      }

      // Event handler metadata
      const eventMetadata =
        Reflect.getMetadata(DI_EVENT_HANDLER, target) ||
        Reflect.getMetadata('event-handler', target);
      if (
        eventMetadata?.messageType ||
        eventMetadata?.event ||
        eventMetadata?.eventType ||
        eventMetadata?.eventName
      ) {
        return {
          type: 'event',
          messageType:
            eventMetadata.messageType ||
            eventMetadata.event ||
            eventMetadata.eventType ||
            eventMetadata.eventName,
        };
      }

      // Domain service metadata
      const serviceMetadata = Reflect.getMetadata(DOMAIN_SERVICE, target);
      if (serviceMetadata) {
        return {
          type: 'domain-service',
          messageType: target,
        };
      }
    } catch {
      // Skip metadata errors
    }

    return null;
  }

  /** @returns how many handlers reached a bus — 0 with a non-empty input means nothing is wired */
  private async registerHandlersWithBuses(handlers: HandlerInfo[]): Promise<number> {
    let registered = 0;
    for (const handler of handlers) {
      try {
        const { handlerType, messageType } = handler;

        const handlerFactory = (): unknown => {
          return this.moduleRef.get(handlerType, { strict: false });
        };

        if (handler.type === 'command' && this.commandBus) {
          registered++;
          const bus = this.commandBus as unknown as BusWithRegistration;
          // F-M5: bus-scoped ledger prevents double-registering the same
          // handler (e.g. when forRoot() and forContext() each run their own
          // VytchesExplorerService instance against the same shared bus) and
          // rejects a genuine conflict (a different handler claiming the
          // same messageType on the same bus).
          const claim = BusRegistrationLedger.claimCommandOrQuery(
            bus,
            'command',
            messageType,
            handlerType
          );
          if (claim === 'register') {
            if (typeof bus.registerFactory === 'function') {
              bus.registerFactory(messageType, handlerFactory);
            } else if (typeof bus.register === 'function') {
              bus.register(messageType, handlerFactory());
            }
          }
        } else if (handler.type === 'query' && this.queryBus) {
          registered++;
          const bus = this.queryBus as unknown as BusWithRegistration;
          const claim = BusRegistrationLedger.claimCommandOrQuery(
            bus,
            'query',
            messageType,
            handlerType
          );
          if (claim === 'register') {
            if (typeof bus.registerFactory === 'function') {
              bus.registerFactory(messageType, handlerFactory);
            } else if (typeof bus.register === 'function') {
              bus.register(messageType, handlerFactory());
            }
          }
        } else if (handler.type === 'event' && this.eventBus) {
          registered++;
          const bus = this.eventBus as unknown as BusWithRegistration;
          const eventTypeName =
            typeof messageType === 'function' ? messageType.name : String(messageType);

          const handlerMeta = handler.metadata as Record<string, unknown> | undefined;
          // F-M5: events legitimately allow multiple distinct handler types
          // per eventType (fan-out) — the ledger only dedupes exact
          // (eventType, handlerType) repeats, it never conflicts here.
          const claim = BusRegistrationLedger.claimEvent(bus, eventTypeName, handlerType);
          if (claim === 'register') {
            if (handlerMeta?.methodName) {
              // Method-level event handler - subscribe with bound method
              const methodName = handlerMeta.methodName as string;
              const instance = handlerFactory() as Record<string, unknown>;
              const method = instance[methodName];
              if (typeof method === 'function' && typeof bus.subscribe === 'function') {
                bus.subscribe(eventTypeName, method.bind(instance));
              }
            } else {
              // Class-level event handler with handle() method
              const handlerInstance = handlerFactory();
              if (typeof bus.registerHandler === 'function') {
                bus.registerHandler(eventTypeName, handlerInstance);
              }
            }
          }
        } else {
          // The handler was discovered but the bus it belongs on was never
          // injected, so it is dropped here without a trace. Every dispatch of
          // this message type then fails at runtime while discovery keeps
          // reporting success — the exact combination that makes a DI token
          // mismatch cost hours to trace. Name the missing bus instead.
          internalLogger.warn(
            `VytchesExplorer: ${handler.type} handler discovered but no ${handler.type} bus is injected — it will not be registered and dispatching this message type will fail`,
            {
              handlerName: handlerType.name,
              handlerType: handler.type,
              messageType:
                typeof messageType === 'function' ? messageType.name : String(messageType),
            }
          );
        }
      } catch (error) {
        // A failed registration leaves the bus without a handler for this
        // message type — every execute() for it will fail at runtime (500).
        // Surface it loudly at error level so the misconfiguration is visible
        // at bootstrap rather than discovered as an opaque runtime failure.
        internalLogger.error(
          'VytchesExplorer: Failed to register handler — messages of this type will fail at runtime',
          error instanceof Error ? error : undefined,
          {
            handlerName: handler.handlerType.name,
            handlerType: handler.type,
            error: error instanceof Error ? error.message : String(error),
          }
        );
        // Opt-in fail-fast: surface the misconfiguration at bootstrap instead
        // of letting it become an opaque runtime failure.
        if (this.strictHandlerRegistration) {
          throw error instanceof Error ? error : new Error(String(error));
        }
      }
    }
    return registered;
  }

  // Legacy compatibility: `.context` mirrors `_contextOptions.name`, set via
  // configureContext(). Historically this read an unsafely-cast private
  // `contextConfig` field set directly by forContext()/forContexts(); both now
  // go through the real configureContext() API instead (F-M5 / D-3).
  getContextConfiguration(): Record<string, unknown> | null {
    if (!this._contextOptions) {
      return null;
    }
    return { context: this._contextOptions.name, ...this._contextOptions };
  }

  /**
   * Check if command bus was injected (useful for testing DI configuration)
   */
  hasCommandBus(): boolean {
    return this.commandBus !== undefined;
  }

  /**
   * Check if query bus was injected (useful for testing DI configuration)
   */
  hasQueryBus(): boolean {
    return this.queryBus !== undefined;
  }

  /**
   * Check if event bus was injected (useful for testing DI configuration)
   */
  hasEventBus(): boolean {
    return this.eventBus !== undefined;
  }

  async discoverContextHandlers(_context: string, _type: string): Promise<HandlerInfo[]> {
    return [];
  }

  async discoverAllContextHandlers(): Promise<HandlerInfo[]> {
    return this.discoveredHandlers;
  }

  /**
   * Check if ACL registry was injected
   */
  hasACLRegistry(): boolean {
    return this.aclRegistry !== undefined;
  }

  /**
   * Discover @ACLAdapterFor decorated providers and register them in ACLRegistry.
   */
  private async discoverAndRegisterACLAdapters(): Promise<void> {
    if (!this.aclRegistry || !this.discoveryService) {
      return;
    }

    const providers = this.discoveryService.getProviders();
    let registered = 0;

    for (const provider of providers) {
      try {
        const { metatype, instance } = provider;
        if (!metatype || typeof metatype !== 'function' || !instance) {
          continue;
        }

        const aclMetadata: ACLAdapterMetadata | undefined = Reflect.getMetadata(
          ACL_ADAPTER_METADATA,
          metatype
        );

        if (!aclMetadata) {
          continue;
        }

        const { contextName, description, version } = aclMetadata;

        if (this.aclRegistry.hasContext(contextName)) {
          internalLogger.warn('VytchesExplorer: ACL adapter already registered, skipping', {
            contextName,
            adapterClass: metatype.name,
          });
          continue;
        }

        this.aclRegistry.register(contextName, instance, {
          source: 'auto-discovered',
          version: version ?? '1.0.0',
          description,
        });

        registered++;
      } catch {
        // Skip problematic providers
      }
    }
  }
}
