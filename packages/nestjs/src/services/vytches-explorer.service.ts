import type { OnModuleInit } from '@nestjs/common';
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { DiscoveryService, ModuleRef } from '@nestjs/core';
import type { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import type { Constructor } from '@vytches/ddd-di';
// eslint-disable-next-line @nx/enforce-module-boundaries -- Required for DI injection tokens
import { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
import { Logger } from '@vytches/ddd-logging';
import type { HandlerInfo, VytchesContextOptions } from '../types';

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
}

@Injectable()
export class VytchesExplorerService implements OnModuleInit {
  private readonly logger = Logger.forContext('VytchesExplorerService');
  private _contextOptions?: VytchesContextOptions;
  private discoveredHandlers: HandlerInfo[] = [];
  private initialized = false;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly discoveryService: DiscoveryService,
    @Optional() @Inject(ICommandBus) private readonly commandBus?: ICommandBus,
    @Optional() @Inject(IQueryBus) private readonly queryBus?: IQueryBus
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const handlers = await this.discoverHandlers();
      this.discoveredHandlers = handlers;
      await this.registerHandlersWithBuses(handlers);
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
      const handlerInfo = this.extractHandlerInfo(provider);
      if (handlerInfo) {
        handlers.push(handlerInfo);
      }
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
      if (eventMetadata?.messageType || eventMetadata?.event || eventMetadata?.eventType) {
        return {
          type: 'event',
          messageType: eventMetadata.messageType || eventMetadata.event || eventMetadata.eventType,
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

  async discoverContextHandlers(_context: string, _type: string): Promise<HandlerInfo[]> {
    return [];
  }

  async discoverAllContextHandlers(): Promise<HandlerInfo[]> {
    return this.discoveredHandlers;
  }
}
