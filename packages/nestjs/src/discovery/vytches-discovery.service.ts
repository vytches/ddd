/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { Injectable, Logger } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import type { CommandBus, QueryBus } from '@vytches/ddd-cqrs';
import type { UnifiedEventBus } from '@vytches/ddd-events';
import type { ServiceLifetime } from '@vytches/ddd-di';
import type { NestJSContainerAdapter } from '../adapters/nestjs-container.adapter';
import { DOMAIN_SERVICE_METADATA, EVENT_HANDLER_METADATA } from '../constants';

// Import domain service metadata helpers
type MetadataGetter = (target: Function) => unknown;
let getDIDomainServiceMetadata: MetadataGetter | undefined;
let getDomainServiceMetadata: MetadataGetter | undefined;
try {
  const domainServiceModule = require('@vytches/ddd-domain-services');
  getDIDomainServiceMetadata = domainServiceModule.getDIDomainServiceMetadata;
  getDomainServiceMetadata = domainServiceModule.getDomainServiceMetadata;
} catch {
  // Domain services package not available
}

// Type for discovered instances and metadata
type DiscoveredInstance = object;
interface ServiceMetadata {
  serviceId?: string;
  lifetime?: ServiceLifetime;
  context?: string;
  tags?: string[];
  resilience?: unknown;
  timeout?: number;
  commandType?: Function;
  queryType?: Function;
  messageType?: Function; // For handlers using messageType
  eventType?: Function | string;
  eventTypes?: Array<Function | string>;
  sagaId?: string;
  sagaType?: string;
  saga?: {
    sagaType?: string;
    sagaId?: string;
    lifetime?: ServiceLifetime;
    context?: string;
  }; // For saga metadata
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

    // Check for @DomainService - use exported functions for proper metadata access
    let domainServiceMetadata: unknown = null;
    if (getDIDomainServiceMetadata) {
      domainServiceMetadata = getDIDomainServiceMetadata(target);
    }
    if (!domainServiceMetadata && getDomainServiceMetadata) {
      domainServiceMetadata = getDomainServiceMetadata(target);
    }
    // Final fallback to direct metadata check
    if (!domainServiceMetadata) {
      domainServiceMetadata = Reflect.getMetadata(DOMAIN_SERVICE_METADATA, target);
    }

    if (domainServiceMetadata) {
      this.logger.debug(`Found @DomainService metadata on ${target.name}:`, domainServiceMetadata);
      await this.registerDomainService(target, instance, domainServiceMetadata);
      discovered = true;
    }

    // Check for @CommandHandler - use correct DI metadata key
    const commandHandlerMetadata = Reflect.getMetadata('di:handler-metadata', target);
    if (commandHandlerMetadata && commandHandlerMetadata.type === 'command') {
      this.logger.debug(
        `Found @CommandHandler metadata on ${target.name}:`,
        commandHandlerMetadata
      );
      await this.registerCommandHandler(target, instance, commandHandlerMetadata);
      discovered = true;
    }

    // Check for @QueryHandler - use correct DI metadata key
    const queryHandlerMetadata = Reflect.getMetadata('di:handler-metadata', target);
    if (queryHandlerMetadata && queryHandlerMetadata.type === 'query') {
      this.logger.debug(`Found @QueryHandler metadata on ${target.name}:`, queryHandlerMetadata);
      await this.registerQueryHandler(target, instance, queryHandlerMetadata);
      discovered = true;
    }

    // Check for @EventHandler - use correct DI metadata key
    const eventHandlerDIMetadata = Reflect.getMetadata('di:event-handler', target);
    if (eventHandlerDIMetadata) {
      this.logger.debug(
        `Found @EventHandler DI metadata on ${target.name}:`,
        eventHandlerDIMetadata
      );
      await this.registerEventHandler(target, instance, eventHandlerDIMetadata);
      discovered = true;
    } else {
      // Fallback to legacy metadata for compatibility
      const eventHandlerLegacyMetadata = Reflect.getMetadata(EVENT_HANDLER_METADATA, target);
      if (eventHandlerLegacyMetadata) {
        this.logger.debug(
          `Found @EventHandler legacy metadata on ${target.name}:`,
          eventHandlerLegacyMetadata
        );
        await this.registerEventHandler(target, instance, eventHandlerLegacyMetadata);
        discovered = true;
      }
    }

    // Check for @Saga - use correct metadata key
    let sagaMetadata: unknown = null;
    try {
      const { SAGA_METADATA_KEY } = await import('@vytches/ddd-messaging');
      sagaMetadata = Reflect.getMetadata(SAGA_METADATA_KEY, target);
    } catch {
      // Fallback to symbol-based access if import fails
      sagaMetadata = Reflect.getMetadata(Symbol.for('saga:metadata'), target);
    }

    if (sagaMetadata) {
      this.logger.debug(`Found @Saga metadata on ${target.name}:`, sagaMetadata);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    metadata: unknown
  ): Promise<void> {
    // Extract command type from DI metadata structure
    const metadataObj = metadata as { messageType?: Function; commandType?: Function };
    const commandType = metadataObj.messageType || metadataObj.commandType;
    if (!commandType) return;
    const handlerId = `${commandType.name}Handler`;

    try {
      // Check if @Injectable is also present - prioritize NestJS DI
      const hasInjectable = Reflect.getMetadata('__injectable__', target);

      if (hasInjectable) {
        // NestJS manages the instance lifecycle - we just register it for VytchesDDD features
        this.adapter.registerInstance(handlerId, instance);
        this.logger.debug(
          `✅ Command handler ${target.name} (NestJS managed) for ${commandType.name}`
        );
      } else {
        // Pure VytchesDDD handler - we manage the lifecycle
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.adapter.register(handlerId, target as any, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          lifetime: 'singleton' as any, // Command handlers typically singleton
          tags: ['command-handler', 'auto-discovered'],
        });
        this.logger.debug(
          `✅ Command handler ${target.name} (VytchesDDD managed) for ${commandType.name}`
        );
      }

      // Get command bus and register the handler
      try {
        const commandBus = this.adapter.resolve<CommandBus>('commandBus');
        if (commandBus && 'register' in commandBus) {
          // Use the actual instance for handler registration
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          commandBus.register(commandType, instance as any);
          this.logger.debug(
            `✅ Registered command handler with bus: ${handlerId} → ${commandType.name}`
          );
        } else {
          this.logger.warn(`CommandBus not found - handler ${handlerId} registration deferred`);
        }
      } catch (busError) {
        this.logger.debug(
          `CommandBus not available yet, handler ${handlerId} will be registered later:`,
          busError
        );
      }

      this.discoveredHandlers.set(handlerId, instance);
    } catch (error) {
      this.logger.error(`❌ Failed to register command handler ${handlerId}:`, error);
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
    // Extract query type from DI metadata structure
    const queryType = metadata.messageType || metadata.queryType;
    if (!queryType) {
      this.logger.warn(`Query handler ${target.name} has no query type`);
      return;
    }
    const handlerId = `${queryType.name}Handler`;

    try {
      // Check if @Injectable is also present - prioritize NestJS DI
      const hasInjectable = Reflect.getMetadata('__injectable__', target);

      if (hasInjectable) {
        // NestJS manages the instance lifecycle - we just register it for VytchesDDD features
        this.adapter.registerInstance(handlerId, instance);
        this.logger.debug(`✅ Query handler ${target.name} (NestJS managed) for ${queryType.name}`);
      } else {
        // Pure VytchesDDD handler - we manage the lifecycle
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.adapter.register(handlerId, target as any, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          lifetime: 'singleton' as any, // Query handlers typically singleton
          tags: ['query-handler', 'auto-discovered'],
        });
        this.logger.debug(
          `✅ Query handler ${target.name} (VytchesDDD managed) for ${queryType.name}`
        );
      }

      // Get query bus and register the handler
      try {
        const queryBus = this.adapter.resolve<QueryBus>('queryBus');
        if (queryBus && 'register' in queryBus) {
          // Use the actual instance for handler registration
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          queryBus.register(queryType, instance as any);
          this.logger.debug(
            `✅ Registered query handler with bus: ${handlerId} → ${queryType.name}`
          );
        } else {
          this.logger.warn(`QueryBus not found - handler ${handlerId} registration deferred`);
        }
      } catch (busError) {
        this.logger.debug(
          `QueryBus not available yet, handler ${handlerId} will be registered later:`,
          busError
        );
      }

      this.discoveredHandlers.set(handlerId, instance);
    } catch (error) {
      this.logger.error(`❌ Failed to register query handler ${handlerId}:`, error);
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
      const hasInjectable = Reflect.getMetadata('__injectable__', target);

      if (hasInjectable) {
        // NestJS manages the instance lifecycle - we just register it for VytchesDDD features
        this.adapter.registerInstance(handlerId, instance);
        this.logger.debug(`✅ Event handler ${target.name} (NestJS managed)`);
      } else {
        // Pure VytchesDDD handler - we manage the lifecycle
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.adapter.register(handlerId, target as any, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          lifetime: 'transient' as any, // Event handlers typically don't need singleton
          tags: ['event-handler', 'auto-discovered'],
        });
        this.logger.debug(`✅ Event handler ${target.name} (VytchesDDD managed)`);
      }

      // Get event bus and subscribe the handler
      try {
        const eventBus = this.adapter.resolve<UnifiedEventBus>('eventBus');
        if (eventBus && 'subscribe' in eventBus) {
          // Extract event type from metadata structure
          // Handle both DI metadata and legacy metadata formats
          let eventType: string | Function | undefined;

          if (metadata.eventType) {
            // DI metadata format
            eventType = metadata.eventType;
          } else if (metadata.eventTypes && metadata.eventTypes.length > 0) {
            // Legacy metadata format
            eventType = metadata.eventTypes[0];
          }

          if (!eventType) {
            this.logger.warn(
              `No event types found for ${target.name}. ` +
                `Make sure @EventHandler decorator is properly applied.`
            );
            return;
          }

          if (instance && 'handle' in instance) {
            // Support both constructor types and string event names
            const eventName = typeof eventType === 'function' ? eventType.name : eventType;

            eventBus.subscribe(eventName, async (event: DiscoveredInstance) => {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (instance as any).handle(event);
              } catch (error) {
                this.logger.error(
                  `❌ Error in event handler ${target.name} for ${eventName}:`,
                  error
                );
                // Don't throw - other handlers should still execute
              }
            });

            this.logger.debug(`✅ Registered event handler ${target.name} for: ${eventName}`);
          } else {
            this.logger.warn(`❌ Handler ${target.name} does not have a 'handle' method`);
          }
        } else {
          this.logger.warn(`EventBus not found - handler ${handlerId} registration deferred`);
        }
      } catch (busError) {
        this.logger.debug(
          `EventBus not available yet, handler ${handlerId} will be registered later:`,
          busError
        );
      }

      this.discoveredHandlers.set(handlerId, instance);
    } catch (error) {
      this.logger.error(`❌ Failed to register event handler ${handlerId}:`, error);
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
    // Extract saga ID from metadata structure
    const sagaConfig = metadata.saga || metadata;
    const sagaId = sagaConfig.sagaType || sagaConfig.sagaId || target.name;

    try {
      // Check if @Injectable is also present - prioritize NestJS DI
      const hasInjectable = Reflect.getMetadata('__injectable__', target);

      if (hasInjectable) {
        // NestJS manages the instance lifecycle - register for VytchesDDD features
        this.adapter.registerInstance(sagaId, instance);
        this.logger.debug(`✅ Saga ${target.name} (NestJS managed) - ${sagaId}`);
      } else {
        // Pure VytchesDDD saga - we manage the lifecycle
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.adapter.register(sagaId, target as any, {
          lifetime: (sagaConfig as any).lifetime || ('transient' as ServiceLifetime),
          tags: ['saga', 'auto-discovered'],
          context: sagaConfig.context,
        });
        this.logger.debug(`✅ Saga ${target.name} (VytchesDDD managed) - ${sagaId}`);
      }

      // TODO: Register saga with saga orchestrator if available
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sagaOrchestrator = this.adapter.resolve<any>('sagaOrchestrator');
        if (sagaOrchestrator && 'registerSaga' in sagaOrchestrator) {
          sagaOrchestrator.registerSaga(sagaId, instance);
          this.logger.debug(`✅ Registered saga with orchestrator: ${sagaId}`);
        }
      } catch (orchestratorError) {
        this.logger.debug(
          `SagaOrchestrator not available yet, saga ${sagaId} will be registered later:`,
          orchestratorError
        );
      }

      this.discoveredServices.set(sagaId, instance);
    } catch (error) {
      this.logger.error(`❌ Failed to register saga ${sagaId}:`, error);
      // Don't throw - continue with other services
    }
  }

  /**
   * Get all providers from NestJS container
   * Simplified to prevent scanning issues
   */
  public getAllProviders(): Map<symbol | string | Function, DiscoveredInstance> {
    const providers = new Map<symbol | string | Function, DiscoveredInstance>();
    const maxProviders = 1000; // Prevent runaway scanning

    try {
      // Use NestJS internal API to get all providers
      // This accesses the internal container to find all registered providers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
