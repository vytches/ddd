import type { Provider, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

/**
 * VytchesDDDBulkProvider - Approved Solution for Bulk Handler Registration
 *
 * Solves the "20+ handlers registration nightmare" by providing utilities that:
 * 1. Use ModuleRef.get() to prevent double-registry issues
 * 2. Handle bulk registration efficiently
 * 3. Use NestJS as primary DI with VytchesDDD for metadata only
 * 4. Include proper error handling and validation
 *
 * @example Basic handler registration
 * ```typescript
 * @Module({
 *   providers: [
 *     CreateUserHandler,
 *     UpdateUserHandler,
 *     DeleteUserHandler,
 *     GetUserHandler,
 *     // ... many more handlers
 *
 *     // Bulk registration utility
 *     {
 *       provide: 'BULK_HANDLERS_REGISTRAR',
 *       useFactory: (moduleRef: ModuleRef) =>
 *         VytchesDDDBulkProvider.createRegistrar(moduleRef, {
 *           handlers: [CreateUserHandler, UpdateUserHandler, DeleteUserHandler, GetUserHandler],
 *           autoRegisterWithVytchesDDD: true
 *         }),
 *       inject: [ModuleRef],
 *     }
 *   ]
 * })
 * ```
 *
 * @example Mixed service types
 * ```typescript
 * @Module({
 *   providers: [
 *     // Individual service registrations
 *     UserService,
 *     OrderService,
 *     CreateUserHandler,
 *     GetUserHandler,
 *
 *     // Bulk registrar
 *     VytchesDDDBulkProvider.createBulkRegistrar({
 *       services: [UserService, OrderService],
 *       handlers: [CreateUserHandler, GetUserHandler],
 *       options: { enableVytchesDDDCapabilities: true }
 *     })
 *   ]
 * })
 * ```
 */
export class VytchesDDDBulkProvider {
  /**
   * Create a bulk registrar that uses ModuleRef.get() to fetch existing instances
   *
   * This prevents double-registry issues by:
   * - Fetching instances that NestJS has already created
   * - Registering those instances with VytchesDDD for metadata/capabilities
   * - Never creating duplicate instances
   *
   * @param moduleRef - NestJS ModuleRef for fetching instances
   * @param config - Configuration for what to register
   * @returns Registration function that can be called during module init
   */
  static createRegistrar(moduleRef: ModuleRef, config: BulkRegistrationConfig): BulkRegistrar {
    return new BulkRegistrar(moduleRef, config);
  }

  /**
   * Create a provider that sets up bulk registration during module initialization
   *
   * @param config - Configuration for bulk registration
   * @returns NestJS provider that handles bulk registration
   */
  static createBulkRegistrar(config: MixedServiceConfig): Provider {
    return {
      provide: `BULK_REGISTRAR_${Date.now()}`,
      useFactory: (moduleRef: ModuleRef) => {
        return VytchesDDDBulkProvider.createRegistrar(moduleRef, {
          handlers: config.handlers || [],
          services: config.domainServices || [],
          eventHandlers: config.eventHandlers || [],
          sagas: config.sagas || [],
          options: config.options || {},
        });
      },
      inject: [ModuleRef],
    };
  }

  /**
   * Create standard NestJS providers for handler classes
   * This method focuses purely on NestJS registration
   *
   * @param handlers - Array of handler classes
   * @returns Array of standard NestJS providers
   */
  static forHandlers<T = any>(handlers: Type<T>[]): Provider[] {
    return handlers.map(HandlerClass => ({
      provide: HandlerClass,
      useClass: HandlerClass,
    }));
  }

  /**
   * Create standard NestJS providers for domain service classes
   *
   * @param services - Array of service classes
   * @returns Array of standard NestJS providers
   */
  static forDomainServices<T = any>(services: Type<T>[]): Provider[] {
    return services.map(ServiceClass => ({
      provide: ServiceClass,
      useClass: ServiceClass,
    }));
  }

  /**
   * Create standard NestJS providers for mixed service types
   *
   * @param config - Configuration with different service types
   * @returns Array of NestJS providers
   */
  static forMixedServices(config: MixedServiceConfig): Provider[] {
    const providers: Provider[] = [];

    if (config.handlers) {
      providers.push(...this.forHandlers(config.handlers));
    }

    if (config.domainServices) {
      providers.push(...this.forDomainServices(config.domainServices));
    }

    if (config.eventHandlers) {
      providers.push(...this.forHandlers(config.eventHandlers));
    }

    if (config.sagas) {
      providers.push(...this.forDomainServices(config.sagas));
    }

    if (config.customProviders) {
      providers.push(...config.customProviders);
    }

    // Add the bulk registrar
    providers.push(this.createBulkRegistrar(config));

    return providers;
  }

  /**
   * Validation helper - check if all classes are proper constructors
   *
   * @param classes - Array of classes to validate
   * @throws Error if any class is invalid
   */
  static validateClasses(classes: Type<any>[]): void {
    for (const ClassType of classes) {
      if (typeof ClassType !== 'function') {
        throw new Error(`Invalid class provided: ${ClassType}. Must be a constructor function.`);
      }

      if (!ClassType.prototype) {
        throw new Error(`Invalid class provided: ${ClassType.name}. Must have a prototype.`);
      }
    }
  }

  /**
   * Validation helper - check if ModuleRef is available and working
   *
   * @param moduleRef - ModuleRef instance to validate
   * @throws Error if ModuleRef is invalid
   */
  static validateModuleRef(moduleRef: ModuleRef): void {
    if (!moduleRef) {
      throw new Error('ModuleRef is required for VytchesDDDBulkProvider');
    }

    if (typeof moduleRef.get !== 'function') {
      throw new Error('ModuleRef must have a get() method');
    }
  }
}

/**
 * Bulk registrar class that handles the actual registration logic
 */
export class BulkRegistrar {
  private registered = false;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly config: BulkRegistrationConfig
  ) {
    // Validate inputs
    VytchesDDDBulkProvider.validateModuleRef(moduleRef);

    if (config.handlers) {
      VytchesDDDBulkProvider.validateClasses(config.handlers);
    }

    if (config.services) {
      VytchesDDDBulkProvider.validateClasses(config.services);
    }
  }

  /**
   * Perform bulk registration using ModuleRef.get()
   *
   * This is the core of the approved solution - it fetches existing
   * NestJS-managed instances and registers them with VytchesDDD
   */
  async registerAll(): Promise<BulkRegistrationResult> {
    if (this.registered) {
      throw new Error('Bulk registration has already been performed');
    }

    const result: BulkRegistrationResult = {
      handlers: [],
      services: [],
      eventHandlers: [],
      sagas: [],
      errors: [],
    };

    try {
      // Register handlers
      if (this.config.handlers) {
        await this.registerHandlers(this.config.handlers, result);
      }

      // Register domain services
      if (this.config.services) {
        await this.registerServices(this.config.services, result);
      }

      // Register event handlers
      if (this.config.eventHandlers) {
        await this.registerEventHandlers(this.config.eventHandlers, result);
      }

      // Register sagas
      if (this.config.sagas) {
        await this.registerSagas(this.config.sagas, result);
      }

      this.registered = true;

      console.log('VytchesDDDBulkProvider registration completed:', {
        handlers: result.handlers.length,
        services: result.services.length,
        eventHandlers: result.eventHandlers.length,
        sagas: result.sagas.length,
        errors: result.errors.length,
      });
    } catch (error) {
      result.errors.push({
        type: 'GENERAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
        className: 'BulkRegistrar',
      });
    }

    return result;
  }

  /**
   * Register command/query handlers using ModuleRef.get()
   */
  private async registerHandlers(
    handlers: Type<any>[],
    result: BulkRegistrationResult
  ): Promise<void> {
    // Try to get CommandBus and QueryBus once for all handlers
    let commandBus: any;
    let queryBus: any;

    try {
      const { CommandBus } = await import('@vytches/ddd-cqrs');
      commandBus = this.moduleRef.get(CommandBus, { strict: false });
    } catch (error) {
      console.debug('CommandBus not available:', error instanceof Error ? error.message : error);
    }

    try {
      const { QueryBus } = await import('@vytches/ddd-cqrs');
      queryBus = this.moduleRef.get(QueryBus, { strict: false });
    } catch (error) {
      console.debug('QueryBus not available:', error instanceof Error ? error.message : error);
    }

    for (const HandlerClass of handlers) {
      try {
        // Use ModuleRef.get() to fetch existing NestJS instance
        let instance;
        try {
          instance = this.moduleRef.get(HandlerClass, { strict: false });
        } catch (_getError) {
          // Distinguish between not found vs actual errors
          const errorMessage = _getError instanceof Error ? _getError.message : String(_getError);
          if (
            errorMessage.toLowerCase().includes('not found') ||
            errorMessage.toLowerCase().includes('provider') ||
            errorMessage.toLowerCase().includes('dependency')
          ) {
            // Instance not found in container
            result.errors.push({
              type: 'INSTANCE_NOT_FOUND',
              message: `Handler ${HandlerClass.name} not found in NestJS container`,
              className: HandlerClass.name,
            });
          } else {
            // Actual registration error
            result.errors.push({
              type: 'HANDLER_REGISTRATION_ERROR',
              message: errorMessage,
              className: HandlerClass.name,
            });
          }
          continue;
        }

        if (!instance) {
          result.errors.push({
            type: 'INSTANCE_NOT_FOUND',
            message: `Handler ${HandlerClass.name} not found in NestJS container`,
            className: HandlerClass.name,
          });
          continue;
        }

        // Register with CommandBus/QueryBus based on metadata
        const metadata =
          Reflect.getMetadata('di:handler-metadata', HandlerClass) ||
          Reflect.getMetadata('cqrs:handler', HandlerClass);

        if (metadata?.messageType) {
          // Determine if it's a command or query handler
          const isCommand =
            metadata.type === 'command' || HandlerClass.name.toLowerCase().includes('command');
          const isQuery =
            metadata.type === 'query' || HandlerClass.name.toLowerCase().includes('query');

          if (isCommand && commandBus && typeof commandBus.register === 'function') {
            try {
              commandBus.register(metadata.messageType, instance);
              console.debug(
                `✅ Registered command handler ${HandlerClass.name} for ${metadata.messageType.name}`
              );
            } catch (busError) {
              console.warn(`Failed to register command handler ${HandlerClass.name}:`, busError);
            }
          } else if (isQuery && queryBus && typeof queryBus.register === 'function') {
            try {
              queryBus.register(metadata.messageType, instance);
              console.debug(
                `✅ Registered query handler ${HandlerClass.name} for ${metadata.messageType.name}`
              );
            } catch (busError) {
              console.warn(`Failed to register query handler ${HandlerClass.name}:`, busError);
            }
          }
        }

        // Register with VytchesDDD if enabled
        if (this.config.options?.enableVytchesDDDCapabilities) {
          await this.registerWithVytchesDDD(HandlerClass.name, instance, 'handler');
        }

        result.handlers.push({
          className: HandlerClass.name,
          instance,
          registered: true,
        });
      } catch (error) {
        result.errors.push({
          type: 'HANDLER_REGISTRATION_ERROR',
          message: error instanceof Error ? error.message : String(error),
          className: HandlerClass.name,
        });
      }
    }
  }

  /**
   * Register domain services using ModuleRef.get()
   */
  private async registerServices(
    services: Type<any>[],
    result: BulkRegistrationResult
  ): Promise<void> {
    for (const ServiceClass of services) {
      try {
        // Use ModuleRef.get() to fetch existing NestJS instance
        let instance;
        try {
          instance = this.moduleRef.get(ServiceClass, { strict: false });
        } catch (_getError) {
          // ModuleRef.get() threw an exception - instance not found
          result.errors.push({
            type: 'INSTANCE_NOT_FOUND',
            message: `Service ${ServiceClass.name} not found in NestJS container`,
            className: ServiceClass.name,
          });
          continue;
        }

        if (!instance) {
          result.errors.push({
            type: 'INSTANCE_NOT_FOUND',
            message: `Service ${ServiceClass.name} not found in NestJS container`,
            className: ServiceClass.name,
          });
          continue;
        }

        // Always register domain services with VytchesDDD
        await this.registerWithVytchesDDD(ServiceClass.name, instance, 'service');

        result.services.push({
          className: ServiceClass.name,
          instance,
          registered: true,
        });
      } catch (error) {
        result.errors.push({
          type: 'SERVICE_REGISTRATION_ERROR',
          message: error instanceof Error ? error.message : String(error),
          className: ServiceClass.name,
        });
      }
    }
  }

  /**
   * Register event handlers using ModuleRef.get()
   */
  private async registerEventHandlers(
    eventHandlers: Type<any>[],
    result: BulkRegistrationResult
  ): Promise<void> {
    // Try to get EventBus once for all handlers
    let eventBus: any;

    try {
      const { UnifiedEventBus } = await import('@vytches/ddd-events');
      eventBus = this.moduleRef.get(UnifiedEventBus, { strict: false });
    } catch (error) {
      // Try alternative event bus names
      try {
        eventBus = this.moduleRef.get('UnifiedEventBus', { strict: false });
      } catch {
        console.debug('EventBus not available:', error instanceof Error ? error.message : error);
      }
    }

    for (const HandlerClass of eventHandlers) {
      try {
        let instance;
        try {
          instance = this.moduleRef.get(HandlerClass, { strict: false });
        } catch (_getError) {
          // ModuleRef.get() threw an exception - instance not found
          result.errors.push({
            type: 'INSTANCE_NOT_FOUND',
            message: `Event handler ${HandlerClass.name} not found in NestJS container`,
            className: HandlerClass.name,
          });
          continue;
        }

        if (!instance) {
          result.errors.push({
            type: 'INSTANCE_NOT_FOUND',
            message: `Event handler ${HandlerClass.name} not found in NestJS container`,
            className: HandlerClass.name,
          });
          continue;
        }

        // Register with EventBus based on metadata
        const metadata =
          Reflect.getMetadata('di:event-handler', HandlerClass) ||
          Reflect.getMetadata('events:handler', HandlerClass);

        if (metadata?.eventType && eventBus && typeof eventBus.subscribe === 'function') {
          try {
            // Event bus uses subscribe method instead of register
            eventBus.subscribe(metadata.eventType, instance);
            console.debug(
              `✅ Registered event handler ${HandlerClass.name} for ${metadata.eventType.name || metadata.eventType}`
            );
          } catch (busError) {
            console.warn(`Failed to register event handler ${HandlerClass.name}:`, busError);
          }
        }

        // Register with VytchesDDD if enabled
        if (this.config.options?.enableVytchesDDDCapabilities) {
          await this.registerWithVytchesDDD(HandlerClass.name, instance, 'event-handler');
        }

        result.eventHandlers.push({
          className: HandlerClass.name,
          instance,
          registered: true,
        });
      } catch (error) {
        result.errors.push({
          type: 'EVENT_HANDLER_REGISTRATION_ERROR',
          message: error instanceof Error ? error.message : String(error),
          className: HandlerClass.name,
        });
      }
    }
  }

  /**
   * Register sagas using ModuleRef.get()
   */
  private async registerSagas(sagas: Type<any>[], result: BulkRegistrationResult): Promise<void> {
    for (const SagaClass of sagas) {
      try {
        let instance;
        try {
          instance = this.moduleRef.get(SagaClass, { strict: false });
        } catch (_getError) {
          // ModuleRef.get() threw an exception - instance not found
          result.errors.push({
            type: 'INSTANCE_NOT_FOUND',
            message: `Saga ${SagaClass.name} not found in NestJS container`,
            className: SagaClass.name,
          });
          continue;
        }

        if (!instance) {
          result.errors.push({
            type: 'INSTANCE_NOT_FOUND',
            message: `Saga ${SagaClass.name} not found in NestJS container`,
            className: SagaClass.name,
          });
          continue;
        }

        // Register with VytchesDDD if enabled
        if (this.config.options?.enableVytchesDDDCapabilities) {
          await this.registerWithVytchesDDD(SagaClass.name, instance, 'saga');
        }

        result.sagas.push({
          className: SagaClass.name,
          instance,
          registered: true,
        });
      } catch (error) {
        result.errors.push({
          type: 'SAGA_REGISTRATION_ERROR',
          message: error instanceof Error ? error.message : String(error),
          className: SagaClass.name,
        });
      }
    }
  }

  /**
   * Register an instance with VytchesDDD (optional capability enhancement)
   */
  private async registerWithVytchesDDD(
    serviceId: string,
    instance: any,
    type: 'handler' | 'service' | 'event-handler' | 'saga'
  ): Promise<void> {
    try {
      // Lazy import to avoid dependency issues
      const { VytchesDDD } = await import('@vytches/ddd-di');

      // Get the global container and register instance
      const globalContainer = VytchesDDD.getGlobalContainer();
      if (globalContainer && 'registerInstance' in globalContainer) {
        (globalContainer as any).registerInstance(serviceId, instance, {
          tags: [type, 'bulk-registered'],
          context: this.config.options?.context,
        });
        console.debug(`Registered ${serviceId} with VytchesDDD as ${type}`);
      } else {
        console.debug(`VytchesDDD container not available for ${serviceId}`);
      }
    } catch (error) {
      console.warn(
        `Failed to register ${serviceId} with VytchesDDD:`,
        error instanceof Error ? error.message : error
      );
      // Don't throw - VytchesDDD registration is optional
    }
  }
}

/**
 * Configuration for bulk registration
 */
export interface BulkRegistrationConfig {
  /**
   * Command and Query handlers to register
   */
  handlers?: Type<any>[];

  /**
   * Domain services to register
   */
  services?: Type<any>[];

  /**
   * Event handlers to register
   */
  eventHandlers?: Type<any>[];

  /**
   * Sagas to register
   */
  sagas?: Type<any>[];

  /**
   * Registration options
   */
  options?: BulkProviderOptions;
}

/**
 * Configuration options for bulk provider registration
 */
export interface BulkProviderOptions {
  /**
   * Enable VytchesDDD capability enhancement
   * @default false for handlers, true for domain services
   */
  enableVytchesDDDCapabilities?: boolean;

  /**
   * Default timeout for operations (milliseconds)
   */
  timeout?: number;

  /**
   * Resilience configuration
   */
  resilience?: {
    retries?: number;
    circuitBreaker?: boolean;
    bulkhead?: boolean;
  };

  /**
   * Bounded context name
   */
  context?: string;
}

/**
 * Configuration for mixed service type registration
 */
export interface MixedServiceConfig {
  /**
   * Command, Query handlers
   */
  handlers?: Type<any>[];

  /**
   * Domain services
   */
  domainServices?: Type<any>[];

  /**
   * Event handlers
   */
  eventHandlers?: Type<any>[];

  /**
   * Sagas
   */
  sagas?: Type<any>[];

  /**
   * Options for registration
   */
  options?: BulkProviderOptions;

  /**
   * Custom NestJS providers to include
   */
  customProviders?: Provider[];
}

/**
 * Result of bulk registration operation
 */
export interface BulkRegistrationResult {
  /**
   * Successfully registered handlers
   */
  handlers: RegisteredService[];

  /**
   * Successfully registered services
   */
  services: RegisteredService[];

  /**
   * Successfully registered event handlers
   */
  eventHandlers: RegisteredService[];

  /**
   * Successfully registered sagas
   */
  sagas: RegisteredService[];

  /**
   * Registration errors
   */
  errors: RegistrationError[];
}

/**
 * Information about a successfully registered service
 */
export interface RegisteredService {
  /**
   * Class name of the registered service
   */
  className: string;

  /**
   * The actual instance that was registered
   */
  instance: any;

  /**
   * Whether registration was successful
   */
  registered: boolean;
}

/**
 * Information about a registration error
 */
export interface RegistrationError {
  /**
   * Type of error that occurred
   */
  type:
    | 'INSTANCE_NOT_FOUND'
    | 'HANDLER_REGISTRATION_ERROR'
    | 'SERVICE_REGISTRATION_ERROR'
    | 'EVENT_HANDLER_REGISTRATION_ERROR'
    | 'SAGA_REGISTRATION_ERROR'
    | 'GENERAL_ERROR';

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Class name where the error occurred
   */
  className: string;
}

/**
 * Type helper for service classes
 */
export type ServiceClass<T = any> = Type<T>;

/**
 * Type helper for handler classes
 */
export type HandlerClass<T = any> = Type<T>;
