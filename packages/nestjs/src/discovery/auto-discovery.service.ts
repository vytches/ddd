import { Injectable } from '@nestjs/common';
import type { CommandBus, QueryBus } from '@vytches/ddd-cqrs';
import type { UnifiedEventBus } from '@vytches/ddd-events';
import type { NestJSContainerAdapter } from '../adapters/nestjs-container.adapter';
import {
  COMMAND_HANDLER_METADATA,
  DEFAULT_DISCOVERY_PATTERNS,
  DEFAULT_EXCLUDE_PATTERNS,
  DOMAIN_SERVICE_METADATA,
  EVENT_HANDLER_METADATA,
  QUERY_HANDLER_METADATA,
  SAGA_METADATA,
} from '../constants';
import type { AutoDiscoveryOptions } from '../types';

/**
 * Represents a class constructor with metadata
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClassConstructor = new (...args: any[]) => any;

/**
 * Represents module metadata structure
 */
interface ModuleMetadata {
  providers?: unknown[];
  controllers?: unknown[];
}

/**
 * Represents decorator metadata
 */
interface DecoratorMetadata {
  serviceId?: string;
  lifetime?: string;
  context?: string;
  tags?: string[];
  commandType?: string;
  queryType?: string;
  eventTypes?: string[];
}

/**
 * Service for auto-discovering and registering DDD decorators
 */
@Injectable()
export class AutoDiscoveryService {
  private readonly options: Required<AutoDiscoveryOptions>;

  constructor(
    private readonly adapter: NestJSContainerAdapter,
    options: Partial<AutoDiscoveryOptions> = {}
  ) {
    this.options = {
      enabled: true,
      patterns: options.patterns || DEFAULT_DISCOVERY_PATTERNS,
      contexts: options.contexts || [],
      exclude: options.exclude || DEFAULT_EXCLUDE_PATTERNS,
    };
  }

  /**
   * Discover and register all decorated classes
   */
  async discover(): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    // Get all modules from the application
    const modules = this.getAllModules();

    // Process each module
    for (const module of modules) {
      await this.processModule(module);
    }
  }

  /**
   * Process a single module for decorated classes
   */
  private async processModule(module: ModuleMetadata): Promise<void> {
    // Get module metadata
    const providers = Reflect.getMetadata('providers', module) || [];
    const controllers = Reflect.getMetadata('controllers', module) || [];

    // Process providers
    for (const provider of providers) {
      await this.processClass(provider);
    }

    // Process controllers
    for (const controller of controllers) {
      await this.processClass(controller);
    }
  }

  /**
   * Process a single class for DDD decorators
   */
  private async processClass(target: ClassConstructor): Promise<void> {
    if (!target || typeof target !== 'function') {
      return;
    }

    // Check for @DomainService
    const domainServiceMetadata = Reflect.getMetadata(DOMAIN_SERVICE_METADATA, target);
    if (domainServiceMetadata) {
      await this.registerDomainService(target, domainServiceMetadata);
    }

    // Check for @CommandHandler
    const commandHandlerMetadata = Reflect.getMetadata(COMMAND_HANDLER_METADATA, target);
    if (commandHandlerMetadata) {
      await this.registerCommandHandler(target, commandHandlerMetadata);
    }

    // Check for @QueryHandler
    const queryHandlerMetadata = Reflect.getMetadata(QUERY_HANDLER_METADATA, target);
    if (queryHandlerMetadata) {
      await this.registerQueryHandler(target, queryHandlerMetadata);
    }

    // Check for @EventHandler
    const eventHandlerMetadata = Reflect.getMetadata(EVENT_HANDLER_METADATA, target);
    if (eventHandlerMetadata) {
      await this.registerEventHandler(target, eventHandlerMetadata);
    }

    // Check for @Saga
    const sagaMetadata = Reflect.getMetadata(SAGA_METADATA, target);
    if (sagaMetadata) {
      await this.registerSaga(target, sagaMetadata);
    }
  }

  /**
   * Register a domain service
   */
  private async registerDomainService(target: ClassConstructor, metadata: DecoratorMetadata): Promise<void> {
    // Check if context matches filter
    if (!this.matchesContext(metadata.context)) {
      return;
    }

    const serviceId = metadata.serviceId || target.name;

    // Register in the adapter
    this.adapter.register(serviceId, target, {
      lifetime: metadata.lifetime,
      context: metadata.context,
      tags: [...(metadata.tags || []), 'domain-service', 'auto-discovered'],
    });
  }

  /**
   * Register a command handler
   */
  private async registerCommandHandler(target: ClassConstructor, metadata: DecoratorMetadata): Promise<void> {
    // Check if context matches filter
    if (!this.matchesContext(metadata.context)) {
      return;
    }

    // Get command bus from container
    const commandBus = this.adapter.resolve<CommandBus>('commandBus');
    if (commandBus && 'register' in commandBus) {
      // Create handler instance
      const handler = this.adapter.resolve<unknown>(target);

      // Register with command bus
      commandBus.register(metadata.commandType, handler);
    }

    // Also register the handler itself in the container
    this.adapter.register(target.name, target, {
      context: metadata.context,
      tags: ['command-handler', 'auto-discovered'],
    });
  }

  /**
   * Register a query handler
   */
  private async registerQueryHandler(target: ClassConstructor, metadata: DecoratorMetadata): Promise<void> {
    // Check if context matches filter
    if (!this.matchesContext(metadata.context)) {
      return;
    }

    // Get query bus from container
    const queryBus = this.adapter.resolve<QueryBus>('queryBus');
    if (queryBus && 'register' in queryBus) {
      // Create handler instance
      const handler = this.adapter.resolve<unknown>(target);

      // Register with query bus
      queryBus.register(metadata.queryType, handler);
    }

    // Also register the handler itself in the container
    this.adapter.register(target.name, target, {
      context: metadata.context,
      tags: ['query-handler', 'auto-discovered'],
    });
  }

  /**
   * Register an event handler
   */
  private async registerEventHandler(target: ClassConstructor, metadata: DecoratorMetadata): Promise<void> {
    // Check if context matches filter
    if (!this.matchesContext(metadata.context)) {
      return;
    }

    // Get event bus from container
    const eventBus = this.adapter.resolve<UnifiedEventBus>('eventBus');
    if (eventBus && 'subscribe' in eventBus) {
      // Create handler instance
      const handler = this.adapter.resolve<unknown>(target);

      // Subscribe to events
      if (metadata.eventTypes && Array.isArray(metadata.eventTypes)) {
        metadata.eventTypes.forEach((eventType: string) => {
          if (handler && handler.handle) {
            eventBus.subscribe(eventType, handler.handle.bind(handler));
          }
        });
      }
    }

    // Also register the handler itself in the container
    this.adapter.register(target.name, target, {
      context: metadata.context,
      tags: ['event-handler', 'auto-discovered'],
    });
  }

  /**
   * Register a saga
   */
  private async registerSaga(target: ClassConstructor, metadata: DecoratorMetadata): Promise<void> {
    // Check if context matches filter
    if (!this.matchesContext(metadata.context)) {
      return;
    }

    // Register the saga in the container
    this.adapter.register(target.name, target, {
      context: metadata.context,
      tags: ['saga', 'auto-discovered'],
    });
  }

  /**
   * Check if a context matches the filter
   */
  private matchesContext(context?: string): boolean {
    // If no contexts specified, match all
    if (!this.options.contexts || this.options.contexts.length === 0) {
      return true;
    }

    // If no context specified on the class, don't match
    if (!context) {
      return false;
    }

    // Check if context is in the filter list
    return this.options.contexts.includes(context);
  }

  /**
   * Get all modules from the application
   * This is a simplified version - actual implementation would need
   * to traverse the module tree from the root module
   */
  private getAllModules(): ModuleMetadata[] {
    // This would need to be implemented based on NestJS internals
    // For now, return empty array - modules will be processed
    // as they are loaded
    return [];
  }
}
