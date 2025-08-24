/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { Injectable, Logger } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import type { CommandBus, QueryBus } from '@vytches/ddd-cqrs';
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
 * Unified VytchesDDD discovery service for zero-config setup
 * Automatically discovers and registers all VytchesDDD decorated classes
 * Combines functionality from EnhancedDiscoveryService and AutoDiscoveryService
 */
@Injectable()
export class VytchesDiscoveryService {
  private readonly logger = new Logger(VytchesDiscoveryService.name);
  private discoveredServices = new Map<string, DiscoveredInstance | Function>();
  private discoveredHandlers = new Map<string, DiscoveredInstance>();
  private processedTargets = new Set<Function>(); // Prevent infinite loops
  private discoveryTimeout: NodeJS.Timeout | null = null;

  constructor(
    private readonly adapter: NestJSContainerAdapter,
    private readonly moduleRef: ModuleRef
  ) {}

  /**
   * Perform zero-config discovery with timeout protection
   * Scans all NestJS providers for VytchesDDD decorators
   */
  async discoverAll(timeout = 3000): Promise<void> {
    this.logger.log('Starting VytchesDDD auto-discovery...');

    // Clear any previous discovery state
    this.processedTargets.clear();

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        this.discoveryTimeout = setTimeout(
          () => reject(new Error(`Discovery timeout after ${timeout}ms`)),
          timeout
        );
      });

      // Create the discovery promise
      const discoveryPromise = this.performDiscovery();

      // Race between discovery and timeout
      await Promise.race([discoveryPromise, timeoutPromise]);

      // Clear timeout if successful
      if (this.discoveryTimeout) {
        clearTimeout(this.discoveryTimeout);
        this.discoveryTimeout = null;
      }

      this.logger.log('VytchesDDD auto-discovery completed successfully');
    } catch (error) {
      this.logger.error('Discovery failed:', error);
      this.logger.warn('Continuing with partial discovery results');

      // Clear timeout on error
      if (this.discoveryTimeout) {
        clearTimeout(this.discoveryTimeout);
        this.discoveryTimeout = null;
      }
    }
  }

  /**
   * Internal method to perform the actual discovery
   */
  private async performDiscovery(): Promise<void> {
    // Get all providers from NestJS container
    const providers = this.getAllProviders();

    let discoveredCount = 0;
    const errors: Error[] = [];

    for (const [token, instance] of providers) {
      try {
        // Get the constructor/class of the instance
        const target = instance?.constructor;
        if (!target || typeof target !== 'function') {
          continue;
        }

        // Skip if already processed (prevent infinite loops)
        if (this.processedTargets.has(target)) {
          continue;
        }
        this.processedTargets.add(target);

        // Check for VytchesDDD decorators
        const wasDiscovered = await this.processTarget(target, instance as DiscoveredInstance);
        if (wasDiscovered) {
          discoveredCount++;
        }
      } catch (error) {
        // Log but don't fail the entire discovery
        this.logger.warn(`Failed to process provider ${String(token)}:`, error);
        errors.push(error as Error);
      }
    }

    this.logger.log(
      `VytchesDDD discovery complete. Found ${discoveredCount} decorated classes${
        errors.length > 0 ? ` (${errors.length} errors)` : ''
      }`
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

    try {
      // If @Injectable is also present, NestJS already manages the instance
      // We just wrap it with VytchesDDD capabilities
      const hasInjectable = Reflect.getMetadata('injectable', target);

      if (hasInjectable) {
        // Wrap existing NestJS instance with VytchesDDD proxy
        const wrappedInstance = this.wrapWithVytchesDDDCapabilities(instance, metadata);

        // Register the wrapped instance in VytchesDDD container
        this.adapter.registerInstance(serviceId, wrappedInstance);

        this.logger.debug(`Registered domain service: ${serviceId} (NestJS managed)`);
      } else {
        // Pure VytchesDDD service - register the class
        this.adapter.register(serviceId, target as any, {
          lifetime: metadata.lifetime,
          context: metadata.context,
          tags: [...(metadata.tags || []), 'domain-service', 'auto-discovered'],
        });

        this.logger.debug(`Registered domain service: ${serviceId} (VytchesDDD managed)`);
      }

      this.discoveredServices.set(serviceId, instance || target);
    } catch (error) {
      this.logger.error(`Failed to register domain service ${serviceId}:`, error);
      // Don't throw - continue with other services
    }
  }

  /**
   * Wrap NestJS instance with VytchesDDD capabilities
   * Simplified to prevent proxy-related issues
   */
  private wrapWithVytchesDDDCapabilities(
    instance: DiscoveredInstance,
    metadata: ServiceMetadata
  ): DiscoveredInstance {
    // For now, return the instance as-is to prevent proxy complications
    // Future enhancement: Add lightweight wrapper for specific behaviors only
    if (metadata.resilience || metadata.timeout) {
      this.logger.debug(
        `Service has resilience/timeout metadata, but proxy wrapping is disabled for stability`
      );
    }
    return instance;
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

    try {
      // Check if @Injectable is also present - prioritize NestJS DI
      const hasInjectable = Reflect.getMetadata('injectable', target);

      if (hasInjectable) {
        // NestJS manages the instance lifecycle - we just register it for VytchesDDD features
        this.adapter.registerInstance(handlerId, instance);
        this.logger.debug(`Command handler ${target.name} (NestJS managed)`);
      } else {
        // Pure VytchesDDD handler - we manage the lifecycle
        this.adapter.register(handlerId, target as any, {
          lifetime: 'singleton' as any, // Command handlers typically singleton
          tags: ['command-handler', 'auto-discovered'],
        });
        this.logger.debug(`Command handler ${target.name} (VytchesDDD managed)`);
      }

      // Get command bus and register the handler
      try {
        const commandBus = this.adapter.resolve<CommandBus>('commandBus');
        if (commandBus && 'register' in commandBus) {
          commandBus.register(metadata.commandType as Function, instance as any);
          this.logger.debug(`Registered command handler: ${handlerId}`);
        }
      } catch (_error) {
        this.logger.debug(
          `CommandBus not available yet, handler ${handlerId} will be registered later`
        );
      }

      this.discoveredHandlers.set(handlerId, instance);
    } catch (error) {
      this.logger.error(`Failed to register command handler ${handlerId}:`, error);
      // Don't throw - continue with other handlers
    }
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

    try {
      // Check if @Injectable is also present - prioritize NestJS DI
      const hasInjectable = Reflect.getMetadata('injectable', target);

      if (hasInjectable) {
        // NestJS manages the instance lifecycle - we just register it for VytchesDDD features
        this.adapter.registerInstance(handlerId, instance);
        this.logger.debug(`Query handler ${target.name} (NestJS managed)`);
      } else {
        // Pure VytchesDDD handler - we manage the lifecycle
        this.adapter.register(handlerId, target as any, {
          lifetime: 'singleton' as any, // Query handlers typically singleton
          tags: ['query-handler', 'auto-discovered'],
        });
        this.logger.debug(`Query handler ${target.name} (VytchesDDD managed)`);
      }

      // Get query bus and register the handler
      try {
        const queryBus = this.adapter.resolve<QueryBus>('queryBus');
        if (queryBus && 'register' in queryBus) {
          queryBus.register(metadata.queryType as Function, instance as any);
          this.logger.debug(`Registered query handler: ${handlerId}`);
        }
      } catch (_error) {
        this.logger.debug(
          `QueryBus not available yet, handler ${handlerId} will be registered later`
        );
      }

      this.discoveredHandlers.set(handlerId, instance);
    } catch (error) {
      this.logger.error(`Failed to register query handler ${handlerId}:`, error);
      // Don't throw - continue with other handlers
    }
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

    try {
      // Check if @Injectable is also present - prioritize NestJS DI
      const hasInjectable = Reflect.getMetadata('injectable', target);

      if (hasInjectable) {
        // NestJS manages the instance lifecycle - we just register it for VytchesDDD features
        this.adapter.registerInstance(handlerId, instance);
        this.logger.debug(`Event handler ${target.name} (NestJS managed)`);
      } else {
        // Pure VytchesDDD handler - we manage the lifecycle
        this.adapter.register(handlerId, target as any, {
          lifetime: 'transient' as any, // Event handlers typically don't need singleton
          tags: ['event-handler', 'auto-discovered'],
        });
        this.logger.debug(`Event handler ${target.name} (VytchesDDD managed)`);
      }

      // Get event bus and subscribe the handler
      try {
        const eventBus = this.adapter.resolve<UnifiedEventBus>('eventBus');
        if (eventBus && 'subscribe' in eventBus) {
          // Handle both eventType (from decorator) and eventTypes (legacy)
          const eventTypes =
            metadata.eventTypes ||
            ((metadata.eventType ? [metadata.eventType] : []) as Array<string | Function>);

          if (eventTypes.length === 0) {
            this.logger.warn(
              `No event types found for ${target.name}. ` +
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
                  this.logger.error(
                    `Error in event handler ${target.name} for ${eventName}:`,
                    error
                  );
                  // Don't throw - other handlers should still execute
                }
              });

              this.logger.debug(`✅ Registered event handler ${target.name} for: ${eventName}`);
            } else {
              this.logger.warn(`Handler ${target.name} does not have a 'handle' method`);
            }
          });
        }
      } catch (_error) {
        this.logger.debug(
          `EventBus not available yet, handler ${handlerId} will be registered later`
        );
      }

      this.discoveredHandlers.set(handlerId, instance);
    } catch (error) {
      this.logger.error(`Failed to register event handler ${handlerId}:`, error);
      // Don't throw - continue with other handlers
    }
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

    try {
      // Register saga instance in VytchesDDD
      this.adapter.registerInstance(sagaId, instance);

      this.logger.debug(`Registered saga: ${sagaId}`);

      this.discoveredServices.set(sagaId, instance);
    } catch (error) {
      this.logger.error(`Failed to register saga ${sagaId}:`, error);
      // Don't throw - continue with other services
    }
  }

  /**
   * Get all providers from NestJS container
   * Simplified to prevent scanning issues
   */
  private getAllProviders(): Map<symbol | string | Function, DiscoveredInstance> {
    const providers = new Map<symbol | string | Function, DiscoveredInstance>();
    const maxProviders = 1000; // Prevent runaway scanning

    try {
      // Use NestJS internal API to get all providers
      // This accesses the internal container to find all registered providers
      const internalProviders = (this.moduleRef as any).providers as Map<
        symbol | string | Function,
        { instance?: DiscoveredInstance }
      >;

      if (internalProviders && internalProviders.size > 0) {
        let count = 0;
        // Iterate through all providers in the container
        for (const [token, wrapper] of internalProviders) {
          if (count++ > maxProviders) {
            this.logger.warn(
              `Stopping discovery after ${maxProviders} providers to prevent timeout`
            );
            break;
          }

          try {
            // Get the instance from the wrapper
            const instance = wrapper?.instance;
            if (instance && typeof instance === 'object') {
              providers.set(token, instance);
            }
          } catch {
            // Instance not available yet, skip
          }
        }
      }

      this.logger.debug(`Found ${providers.size} providers to scan for decorators`);
    } catch (error) {
      this.logger.warn('Could not get all providers:', error);
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
