import type { OnModuleInit } from '@nestjs/common';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { DiscoveryService, ModuleRef } from '@nestjs/core';
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import type { Constructor } from '@vytches/ddd-di';
// eslint-disable-next-line @nx/enforce-module-boundaries -- Required for DI injection tokens
import { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
import { IEventBus, EVENT_HANDLER_METADATA } from '@vytches/ddd-contracts';
import { Logger } from '@vytches/ddd-logging';
import type { HandlerInfo, VytchesContextOptions } from '../types';
import { ACL_ADAPTER_METADATA, ACL_REGISTRY } from '../constants';
import type { ACLAdapterMetadata } from '../decorators/acl-adapter.decorator';

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
 * // In your module - buses are injected automatically:
 * @Module({
 *   imports: [DiscoveryModule],
 *   providers: [
 *     VytchesExplorerService,
 *     { provide: ICommandBus, useValue: new EnhancedCommandBus(container) },
 *     { provide: IQueryBus, useValue: new EnhancedQueryBus(container) },
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
}

@Injectable()
export class VytchesExplorerService implements OnModuleInit {
  private readonly logger = Logger.forContext('VytchesExplorerService');
  private _contextOptions?: VytchesContextOptions;
  private discoveredHandlers: HandlerInfo[] = [];
  private initialized = false;

  constructor(
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Inject(DiscoveryService) private readonly discoveryService: DiscoveryService,
    @Optional() @Inject(ICommandBus) private readonly commandBus?: ICommandBus,
    @Optional() @Inject(IQueryBus) private readonly queryBus?: IQueryBus,
    @Optional() @Inject(IEventBus) private readonly eventBus?: IEventBus,
    @Optional() @Inject(ACL_REGISTRY) private readonly aclRegistry?: IACLRegistryLike
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const handlers = await this.discoverHandlers();
      this.discoveredHandlers = handlers;
      await this.registerHandlersWithBuses(handlers);
      await this.discoverAndRegisterACLAdapters();
      this.initialized = true;
    } catch (error) {
      this.logger.error('Initialization failed', error instanceof Error ? error : undefined, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  configureContext(options: VytchesContextOptions): void {
    this._contextOptions = options;
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

  private async registerHandlersWithBuses(handlers: HandlerInfo[]): Promise<void> {
    for (const handler of handlers) {
      try {
        const { handlerType, messageType } = handler;

        const handlerFactory = (): unknown => {
          return this.moduleRef.get(handlerType, { strict: false });
        };

        if (handler.type === 'command' && this.commandBus) {
          const bus = this.commandBus as unknown as BusWithRegistration;
          if (typeof bus.registerFactory === 'function') {
            bus.registerFactory(messageType, handlerFactory);
          } else if (typeof bus.register === 'function') {
            bus.register(messageType, handlerFactory());
          }
        } else if (handler.type === 'query' && this.queryBus) {
          const bus = this.queryBus as unknown as BusWithRegistration;
          if (typeof bus.registerFactory === 'function') {
            bus.registerFactory(messageType, handlerFactory);
          } else if (typeof bus.register === 'function') {
            bus.register(messageType, handlerFactory());
          }
        } else if (handler.type === 'event' && this.eventBus) {
          const bus = this.eventBus as unknown as BusWithRegistration;
          const eventTypeName =
            typeof messageType === 'function' ? messageType.name : String(messageType);

          const handlerMeta = handler.metadata as Record<string, unknown> | undefined;
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
      } catch (error) {
        this.logger.warn('Failed to register handler', {
          handlerName: handler.handlerType.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // Legacy compatibility
  getContextConfiguration(): Record<string, unknown> | null {
    return ((this as Record<string, unknown>).contextConfig as Record<string, unknown>) || null;
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
          this.logger.warn('ACL adapter already registered, skipping', {
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
        this.logger.info('ACL adapter auto-registered', {
          contextName,
          adapterClass: metatype.name,
        });
      } catch {
        // Skip problematic providers
      }
    }

    if (registered > 0) {
      this.logger.info(`Auto-discovered ${registered} ACL adapter(s)`);
    }
  }
}
