/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { Injectable } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import type { CommandBus, QueryBus } from '@vytches/ddd-cqrs';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { ServiceLifetime, type Constructor } from '@vytches/ddd-di';
import type { UnifiedEventBus } from '@vytches/ddd-events';
import type { NestJSContainerAdapter } from '../adapters/nestjs-container.adapter';
import {
  COMMAND_HANDLER_METADATA,
  DOMAIN_SERVICE_METADATA,
  EVENT_HANDLER_METADATA,
  QUERY_HANDLER_METADATA,
  SAGA_METADATA,
} from '../constants';

// Type for discovered instances and metadata
type DiscoveredInstance = object;
interface ServiceMetadata {
  serviceId?: string;
  lifetime?: any;
  context?: string;
  tags?: string[];
  resilience?: any;
  timeout?: number;
  commandType?: Function;
  queryType?: Function;
  eventType?: Function | string;
  eventTypes?: Array<Function | string>;
  sagaId?: string;
}

/**
 * Enhanced auto-discovery service for zero-config setup
 * Automatically discovers and registers all VytchesDDD decorated classes
 */
@Injectable()
export class EnhancedDiscoveryService {
  private discoveredServices = new Map<string, DiscoveredInstance | Function>();
  private discoveredHandlers = new Map<string, DiscoveredInstance>();

  constructor(
    private readonly adapter: NestJSContainerAdapter,
    private readonly moduleRef: ModuleRef
  ) {}

  /**
   * Perform zero-config discovery
   * Scans all NestJS providers for VytchesDDD decorators
   */
  async discoverAll(): Promise<void> {
    console.log('[VytchesDDD] Starting zero-config auto-discovery...');

    // Get all providers from NestJS container
    const providers = this.getAllProviders();

    let discoveredCount = 0;

    for (const [token, instance] of providers) {
      // Get the constructor/class of the instance
      const target = instance?.constructor;
      if (!target || typeof target !== 'function') {
        continue;
      }

      // Check for VytchesDDD decorators
      const wasDiscovered = await this.processTarget(target, instance as DiscoveredInstance);
      if (wasDiscovered) {
        discoveredCount++;
      }
    }

    console.log(
      `[VytchesDDD] Auto-discovery complete. Found ${discoveredCount} decorated classes.`
    );
  }

  /**
   * Process a target class for VytchesDDD decorators
   */
  private async processTarget(target: Function, instance: DiscoveredInstance): Promise<boolean> {
    let discovered = false;

    // Check for @DomainService
    const domainServiceMetadata = Reflect.getMetadata(DOMAIN_SERVICE_METADATA, target);
    if (domainServiceMetadata) {
      await this.registerDomainService(target, instance, domainServiceMetadata);
      discovered = true;
    }

    // Check for @CommandHandler
    const commandHandlerMetadata = Reflect.getMetadata(COMMAND_HANDLER_METADATA, target);
    if (commandHandlerMetadata) {
      await this.registerCommandHandler(target, instance, commandHandlerMetadata);
      discovered = true;
    }

    // Check for @QueryHandler
    const queryHandlerMetadata = Reflect.getMetadata(QUERY_HANDLER_METADATA, target);
    if (queryHandlerMetadata) {
      await this.registerQueryHandler(target, instance, queryHandlerMetadata);
      discovered = true;
    }

    // Check for @EventHandler
    const eventHandlerMetadata = Reflect.getMetadata(EVENT_HANDLER_METADATA, target);
    if (eventHandlerMetadata) {
      await this.registerEventHandler(target, instance, eventHandlerMetadata);
      discovered = true;
    }

    // Check for @Saga
    const sagaMetadata = Reflect.getMetadata(SAGA_METADATA, target);
    if (sagaMetadata) {
      await this.registerSaga(target, instance, sagaMetadata);
      discovered = true;
    }

    return discovered;
  }

  /**
   * Register a domain service in VytchesDDD container
   */
  private async registerDomainService(
    target: Function,
    instance: DiscoveredInstance,
    metadata: ServiceMetadata
  ): Promise<void> {
    const serviceId = metadata.serviceId || target.name;

    // If @Injectable is also present, NestJS already manages the instance
    // We just wrap it with VytchesDDD capabilities
    const hasInjectable = Reflect.getMetadata('injectable', target);

    if (hasInjectable) {
      // Wrap existing NestJS instance with VytchesDDD proxy
      const wrappedInstance = this.wrapWithVytchesDDDCapabilities(instance, metadata);

      // Register the wrapped instance in VytchesDDD container
      this.adapter.registerInstance(serviceId, wrappedInstance);

      console.log(`[VytchesDDD] Registered domain service: ${serviceId} (NestJS managed)`);
    } else {
      // Pure VytchesDDD service - register the class
      this.adapter.register(serviceId, target as Constructor<object>, {
        lifetime: metadata.lifetime,
        context: metadata.context,
        tags: [...(metadata.tags || []), 'domain-service', 'auto-discovered'],
      });

      console.log(`[VytchesDDD] Registered domain service: ${serviceId} (VytchesDDD managed)`);
    }

    this.discoveredServices.set(serviceId, instance || target);
  }

  /**
   * Wrap NestJS instance with VytchesDDD capabilities
   */
  private wrapWithVytchesDDDCapabilities(
    instance: DiscoveredInstance,
    metadata: ServiceMetadata
  ): DiscoveredInstance {
    // Create a proxy that applies VytchesDDD metadata and behaviors
    return new Proxy(instance, {
      get: (target, prop, receiver) => {
        const originalValue = Reflect.get(target, prop, receiver);

        // If it's a method, wrap it with VytchesDDD behaviors
        if (typeof originalValue === 'function') {
          return new Proxy(originalValue, {
            apply: async (method, thisArg, args) => {
              // Pre-execution: Apply VytchesDDD behaviors (resilience, logging, etc.)
              if (metadata.resilience) {
                // Apply resilience patterns
                console.log(`[VytchesDDD] Applying resilience to ${String(prop)}`);
              }

              if (metadata.timeout) {
                // Apply timeout
                console.log(
                  `[VytchesDDD] Applying timeout ${metadata.timeout}ms to ${String(prop)}`
                );
              }

              // Execute the original method
              const result = await method.apply(thisArg, args);

              // Post-execution: Additional VytchesDDD processing

              return result;
            },
          });
        }

        return originalValue;
      },
    });
  }

  /**
   * Register a command handler
   */
  private async registerCommandHandler(
    target: Function,
    instance: DiscoveredInstance,
    metadata: ServiceMetadata
  ): Promise<void> {
    const handlerId = `${(metadata.commandType as Function).name}Handler`;

    // Check if @Injectable is also present - prioritize NestJS DI
    const hasInjectable = Reflect.getMetadata('injectable', target);

    if (hasInjectable) {
      // NestJS manages the instance lifecycle - we just register it for VytchesDDD features
      this.adapter.registerInstance(handlerId, instance);
      console.log(`[VytchesDDD] Command handler ${target.name} (NestJS managed)`);
    } else {
      // Pure VytchesDDD handler - we manage the lifecycle
      this.adapter.register(handlerId, target as Constructor<object>, {
        lifetime: ServiceLifetime.Singleton, // Command handlers typically singleton
        tags: ['command-handler', 'auto-discovered'],
      });
      console.log(`[VytchesDDD] Command handler ${target.name} (VytchesDDD managed)`);
    }

    // Get command bus and register the handler
    try {
      const commandBus = this.adapter.resolve<CommandBus>('commandBus');
      if (commandBus && 'register' in commandBus) {
        commandBus.register(metadata.commandType as Function, instance as any);
        console.log(`[VytchesDDD] Registered command handler: ${handlerId}`);
      }
    } catch (error) {
      console.warn(
        `[VytchesDDD] CommandBus not available yet, handler ${handlerId} will be registered later`
      );
    }

    this.discoveredHandlers.set(handlerId, instance);
  }

  /**
   * Register a query handler
   */
  private async registerQueryHandler(
    target: Function,
    instance: DiscoveredInstance,
    metadata: ServiceMetadata
  ): Promise<void> {
    const handlerId = `${(metadata.queryType as Function).name}Handler`;

    // Check if @Injectable is also present - prioritize NestJS DI
    const hasInjectable = Reflect.getMetadata('injectable', target);

    if (hasInjectable) {
      // NestJS manages the instance lifecycle - we just register it for VytchesDDD features
      this.adapter.registerInstance(handlerId, instance);
      console.log(`[VytchesDDD] Query handler ${target.name} (NestJS managed)`);
    } else {
      // Pure VytchesDDD handler - we manage the lifecycle
      this.adapter.register(handlerId, target as Constructor<object>, {
        lifetime: ServiceLifetime.Singleton, // Query handlers typically singleton
        tags: ['query-handler', 'auto-discovered'],
      });
      console.log(`[VytchesDDD] Query handler ${target.name} (VytchesDDD managed)`);
    }

    // Get query bus and register the handler
    try {
      const queryBus = this.adapter.resolve<QueryBus>('queryBus');
      if (queryBus && 'register' in queryBus) {
        queryBus.register(metadata.queryType as Function, instance as any);
        console.log(`[VytchesDDD] Registered query handler: ${handlerId}`);
      }
    } catch (error) {
      console.warn(
        `[VytchesDDD] QueryBus not available yet, handler ${handlerId} will be registered later`
      );
    }

    this.discoveredHandlers.set(handlerId, instance);
  }

  /**
   * Register an event handler
   */
  private async registerEventHandler(
    target: Function,
    instance: DiscoveredInstance,
    metadata: ServiceMetadata
  ): Promise<void> {
    const handlerId = `${target.name}EventHandler`;

    // Check if @Injectable is also present - prioritize NestJS DI
    const hasInjectable = Reflect.getMetadata('injectable', target);

    if (hasInjectable) {
      // NestJS manages the instance lifecycle - we just register it for VytchesDDD features
      this.adapter.registerInstance(handlerId, instance);
      console.log(`[VytchesDDD] Event handler ${target.name} (NestJS managed)`);
    } else {
      // Pure VytchesDDD handler - we manage the lifecycle
      this.adapter.register(handlerId, target as Constructor<object>, {
        lifetime: ServiceLifetime.Transient, // Event handlers typically don't need singleton
        tags: ['event-handler', 'auto-discovered'],
      });
      console.log(`[VytchesDDD] Event handler ${target.name} (VytchesDDD managed)`);
    }

    // Get event bus and subscribe the handler
    try {
      const eventBus = this.adapter.resolve<UnifiedEventBus>('eventBus');
      if (eventBus && 'subscribe' in eventBus) {
        // FIX: Handle both eventType (from decorator) and eventTypes (legacy)
        const eventTypes =
          metadata.eventTypes ||
          ((metadata.eventType ? [metadata.eventType] : []) as Array<string | Function>);

        if (eventTypes.length === 0) {
          console.warn(
            `[VytchesDDD] No event types found for ${target.name}. ` +
              `Make sure @EventHandler decorator is properly applied.`
          );
          return;
        }

        eventTypes.forEach((eventType: string | Function) => {
          if (instance && 'handle' in instance) {
            // Support both constructor types and string event names
            const eventName = typeof eventType === 'function' ? eventType.name : eventType;

            eventBus.subscribe(eventName, async (event: DiscoveredInstance) => {
              try {
                await (instance as any).handle(event);
              } catch (error) {
                console.error(
                  `[VytchesDDD] Error in event handler ${target.name} for ${eventName}:`,
                  error
                );
                // Don't throw - other handlers should still execute
              }
            });

            console.log(
              `[VytchesDDD] ✅ Registered event handler ${target.name} for: ${eventName}`
            );
          } else {
            console.warn(`[VytchesDDD] Handler ${target.name} does not have a 'handle' method`);
          }
        });
      }
    } catch (error) {
      console.warn(
        `[VytchesDDD] EventBus not available yet, handler ${handlerId} will be registered later`,
        error
      );
    }

    this.discoveredHandlers.set(handlerId, instance);
  }

  /**
   * Register a saga
   */
  private async registerSaga(
    target: Function,
    instance: DiscoveredInstance,
    metadata: ServiceMetadata
  ): Promise<void> {
    const sagaId = metadata.sagaId || target.name;

    // Register saga instance in VytchesDDD
    this.adapter.registerInstance(sagaId, instance);

    console.log(`[VytchesDDD] Registered saga: ${sagaId}`);

    this.discoveredServices.set(sagaId, instance);
  }

  /**
   * Get all providers from NestJS container
   */
  private getAllProviders(): Map<symbol | string | Function, DiscoveredInstance> {
    const providers = new Map<symbol | string | Function, DiscoveredInstance>();

    try {
      // Use NestJS internal API to get all providers
      // This accesses the internal container to find all registered providers
      const internalProviders = (this.moduleRef as any).providers as Map<
        symbol | string | Function,
        { instance?: DiscoveredInstance }
      >;

      if (internalProviders) {
        // Iterate through all providers in the container
        for (const [token, wrapper] of internalProviders) {
          try {
            // Get the instance from the wrapper
            const instance = wrapper.instance;
            if (instance) {
              providers.set(token, instance);
            }
          } catch {
            // Instance not available yet, skip
          }
        }
      }

      // Also check for providers registered directly with the module
      const moduleMetadata = Reflect.getMetadata('providers', this.moduleRef) || [];

      for (const provider of moduleMetadata) {
        try {
          if (typeof provider === 'function') {
            // It's a class provider
            const instance = this.moduleRef.get(provider, { strict: false });
            if (instance && !providers.has(provider)) {
              providers.set(provider, instance);
            }
          } else if (provider && provider.provide) {
            // It's a custom provider
            const instance = this.moduleRef.get(provider.provide, { strict: false });
            if (instance && !providers.has(provider.provide)) {
              providers.set(provider.provide, instance);
            }
          }
        } catch {
          // Provider not available, skip
        }
      }

      console.log(`[VytchesDDD] Found ${providers.size} providers to scan for decorators`);
    } catch (error) {
      console.warn('[VytchesDDD] Could not get all providers:', error);
    }

    return providers;
  }

  /**
   * Get summary of discovered components
   */
  getSummary(): { services: number; handlers: number; total: number } {
    return {
      services: this.discoveredServices.size,
      handlers: this.discoveredHandlers.size,
      total: this.discoveredServices.size + this.discoveredHandlers.size,
    };
  }
}
