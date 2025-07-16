// Removed logging dependency for Phase 1 simplification
import 'reflect-metadata';
import type { IDependencyContainer, ServiceToken } from './types';
import {
  ServiceNotFoundError,
  ContainerConfigurationError,
  ContainerDisposedError,
} from './errors';
import { HandlerDiscoveryRegistry } from './discovery/handler-discovery-registry';
import type { IHandlerDiscoveryPlugin, HandlerInfo } from './discovery/handler-discovery.interface';

/**
 * @llm-summary Contract for service locator functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ServiceLocator interface implementing infrastructure service for service locator operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteServiceLocator implements IServiceLocator {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IServiceLocator {
  /**
   * Configure the global container
   * @param container - Container instance to use globally
   */
  configure(container: IDependencyContainer): void;

  /**
   * Configure a context-specific container
   * @param contextName - Name of the context
   * @param container - Container instance for the context
   */
  configureContext(contextName: string, container: IDependencyContainer): void;

  /**
   * Smart resolution: context-aware when available, global otherwise
   * @param token - Service token to resolve
   * @param context - Optional context name
   * @returns Resolved service instance
   */
  resolve<T>(token: ServiceToken<T>, context?: string): T;

  /**
   * Get the global container
   * @returns Global container instance
   */
  getGlobalContainer(): IDependencyContainer;

  /**
   * Get a context-specific container
   * @param contextName - Name of the context
   * @returns Context container instance or undefined
   */
  getContext(contextName: string): IDependencyContainer | undefined;

  /**
   * Get all registered contexts
   * @returns Array of context names
   */
  getContexts(): string[];

  /**
   * Check if a service is registered in any container
   * @param token - Service token to check
   * @param context - Optional context to check
   * @returns True if service is registered
   */
  isRegistered<T>(token: ServiceToken<T>, context?: string): boolean;

  /**
   * Auto-discover and register handlers (Phase 2 feature)
   * @param assemblies - Optional assemblies to scan for handlers
   */
  discoverAndRegisterHandlers(assemblies?: any[]): Promise<void>;

  /**
   * Register a handler discovery plugin
   * @param plugin - The discovery plugin to register
   */
  registerDiscoveryPlugin(plugin: IHandlerDiscoveryPlugin): void;

  /**
   * Reset the service locator (useful for testing)
   */
  reset(): void;

  /**
   * Dispose of all containers and clean up resources
   */
  dispose(): void;
}

/**
 * @llm-summary ServiceLocator class for service locator operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * ServiceLocator class implementing infrastructure service for service locator operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ServiceLocator();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new ServiceLocator());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class ServiceLocator implements IServiceLocator {
  private static instance: ServiceLocator;
  // Simple console logging for Phase 1
  private globalContainer?: IDependencyContainer | undefined;
  private readonly contextContainers = new Map<string, IDependencyContainer>();
  private readonly discoveryRegistry = new HandlerDiscoveryRegistry();
  private disposed = false;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // ServiceLocator instance created
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): ServiceLocator {
    if (!ServiceLocator.instance) {
      ServiceLocator.instance = new ServiceLocator();
    }
    return ServiceLocator.instance;
  }

  /**
   * Configure the global container
   */
  configure(container: IDependencyContainer): void {
    this.ensureNotDisposed();

    if (!container) {
      throw new ContainerConfigurationError('Container cannot be null or undefined');
    }

    this.globalContainer = container;

    // Note: Auto-discovery is done separately via discoverAndRegisterHandlers()
    // This allows more control over when discovery happens
  }

  /**
   * Configure a context-specific container
   */
  configureContext(contextName: string, container: IDependencyContainer): void {
    this.ensureNotDisposed();

    if (!contextName) {
      throw new ContainerConfigurationError('Context name cannot be null or empty');
    }

    if (!container) {
      throw new ContainerConfigurationError('Container cannot be null or undefined');
    }

    this.contextContainers.set(contextName, container);
  }

  /**
   * Smart resolution: context-aware when available, global otherwise
   */
  resolve<T>(token: ServiceToken<T>, context?: string): T {
    this.ensureNotDisposed();

    // Resolving service

    // 1. Try context-specific resolution if context provided
    if (context && this.contextContainers.has(context)) {
      const contextContainer = this.contextContainers.get(context)!;

      // Attempting context-specific resolution

      if (contextContainer.isRegistered(token)) {
        const instance = contextContainer.resolve<T>(token);

        // Service resolved from context container

        return instance;
      }

      // Service not found in context, falling back to global
    }

    // 2. Auto-detect context from call stack (Phase 2 enhancement)
    const detectedContext = this.detectContextFromCallStack();
    if (detectedContext && detectedContext !== context) {
      // Auto-detected context from call stack

      if (this.contextContainers.has(detectedContext)) {
        const contextContainer = this.contextContainers.get(detectedContext)!;

        if (contextContainer.isRegistered(token)) {
          const instance = contextContainer.resolve<T>(token);

          // Service resolved from auto-detected context

          return instance;
        }
      }
    }

    // 3. Fallback to global container
    if (!this.globalContainer) {
      throw new ContainerConfigurationError(
        'No global container configured. Call configure() first.'
      );
    }

    // Attempting global resolution

    if (!this.globalContainer.isRegistered(token)) {
      throw new ServiceNotFoundError(token, context);
    }

    const instance = this.globalContainer.resolve<T>(token);

    // Service resolved from global container

    return instance;
  }

  /**
   * Get the global container
   */
  getGlobalContainer(): IDependencyContainer {
    this.ensureNotDisposed();

    if (!this.globalContainer) {
      throw new ContainerConfigurationError(
        'No global container configured. Call configure() first.'
      );
    }

    return this.globalContainer;
  }

  /**
   * Get a context-specific container
   */
  getContext(contextName: string): IDependencyContainer | undefined {
    this.ensureNotDisposed();
    return this.contextContainers.get(contextName);
  }

  /**
   * Get all registered contexts
   */
  getContexts(): string[] {
    this.ensureNotDisposed();
    return Array.from(this.contextContainers.keys());
  }

  /**
   * Check if a service is registered in any container
   */
  isRegistered<T>(token: ServiceToken<T>, context?: string): boolean {
    this.ensureNotDisposed();

    // Checking service registration

    // Check context-specific container first
    if (context && this.contextContainers.has(context)) {
      const contextContainer = this.contextContainers.get(context)!;
      if (contextContainer.isRegistered(token)) {
        return true;
      }
    }

    // Check global container
    if (this.globalContainer && this.globalContainer.isRegistered(token)) {
      return true;
    }

    return false;
  }

  /**
   * Auto-discover and register handlers (Phase 2 implementation)
   */
  async discoverAndRegisterHandlers(assemblies?: any[]): Promise<void> {
    this.ensureNotDisposed();

    if (!this.globalContainer) {
      throw new ContainerConfigurationError(
        'No global container configured. Call configure() first.'
      );
    }

    // Phase 2: Auto-discovery through registered plugins
    const discoveredHandlers = await this.discoveryRegistry.discoverAllHandlers(assemblies);

    // Discovered handlers for registration

    for (const handler of discoveredHandlers) {
      try {
        await this.registerHandlerWithDI(handler);
      } catch (error) {
        console.warn(`Failed to register ${handler.type} handler:`, error);
      }
    }

    // Auto-discovery completed
  }

  /**
   * Register a handler discovery plugin
   */
  registerDiscoveryPlugin(plugin: IHandlerDiscoveryPlugin): void {
    this.ensureNotDisposed();
    this.discoveryRegistry.registerPlugin(plugin);
  }

  /**
   * Scan a module for handlers (for plugin use)
   */
  private scanModule(module: any): HandlerInfo[] {
    const handlers: HandlerInfo[] = [];

    // Get all exported classes from module
    for (const [, value] of Object.entries(module)) {
      if (typeof value === 'function' && value.prototype) {
        // Check for DI handler metadata
        const handlerType = Reflect.getMetadata('di:handler-type', value);
        if (handlerType) {
          const metadata = Reflect.getMetadata(`di:${handlerType}-handler`, value);
          if (metadata && Reflect.getMetadata('di:registration-pending', value)) {
            handlers.push({
              type: handlerType as 'command' | 'query' | 'event',
              messageType: handlerType === 'event' ? metadata.eventType : metadata.messageType,
              handlerType: value as any, // Cast to any to handle Function -> Constructor conversion
              metadata,
            });
          }
        }
      }
    }

    return handlers;
  }

  /**
   * Register a discovered handler with DI container
   */
  private async registerHandlerWithDI(handler: HandlerInfo): Promise<void> {
    if (!this.globalContainer) return;

    const { handlerType, messageType, metadata } = handler;
    const options = metadata.options || metadata; // Support both formats

    try {
      // Determine target container (context-specific or global)
      const targetContainer = options.context
        ? this.contextContainers.get(options.context) || this.globalContainer
        : this.globalContainer;

      // For domain services, register by serviceId if available
      if (handler.type === 'domain-service' && options.serviceId) {
        // Check if already registered to avoid duplicates
        if (!targetContainer.isRegistered(options.serviceId)) {
          targetContainer.register(
            options.serviceId, // Use serviceId as service token
            handlerType, // Handler as implementation
            {
              lifetime: options.lifetime || 'transient',
              context: options.context,
              tags: [`${handler.type}-service`, ...(options.tags || [])],
            }
          );
        }

        // If this is a context-specific service but fallbackToGlobal is true, also register in global
        if (
          options.context &&
          options.fallbackToGlobal &&
          this.globalContainer !== targetContainer
        ) {
          if (!this.globalContainer.isRegistered(options.serviceId)) {
            this.globalContainer.register(
              options.serviceId, // Use serviceId as service token
              handlerType, // Handler as implementation
              {
                lifetime: options.lifetime || 'transient',
                context: options.context,
                tags: [`${handler.type}-service`, 'fallback', ...(options.tags || [])],
              }
            );
          }
        }
      }

      // Register handler class with DI container (if not already registered)
      if (!targetContainer.isRegistered(handlerType)) {
        targetContainer.register(
          handlerType, // Use constructor as service token
          handlerType,
          {
            lifetime: options.lifetime || 'transient',
            context: options.context,
            tags: [`${handler.type}-handler`, ...(options.tags || [])],
          }
        );
      }

      // Register message->handler mapping for bus resolution (if not already registered)
      if (!targetContainer.isRegistered(messageType)) {
        targetContainer.register(
          messageType, // Message type as token
          handlerType, // Handler as implementation
          {
            lifetime: options.lifetime || 'transient',
            context: options.context,
            tags: [`${handler.type}-mapping`, ...(options.tags || [])],
          }
        );
      }

      // Update metadata to mark as registered (but keep registration-pending for re-discovery)
      metadata.registeredWithDI = true;
      Reflect.defineMetadata(`di:${handler.type}-handler`, metadata, handlerType);
      // Don't delete 'di:registration-pending' - keep it for future discoveries
    } catch (error) {
      console.warn(`Failed to register ${handler.type} handler:`, error);
    }
  }

  /**
   * Reset the service locator (useful for testing)
   */
  reset(): void {
    // Resetting service locator

    // Dispose of existing containers
    this.dispose();

    // Clear references
    this.globalContainer = undefined;
    this.contextContainers.clear();
    this.disposed = false;

    // Service locator reset completed
  }

  /**
   * Dispose of all containers and clean up resources
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    // Disposing service locator

    // Dispose global container
    if (this.globalContainer && typeof this.globalContainer.dispose === 'function') {
      try {
        this.globalContainer.dispose();
        // Global container disposed
      } catch (error) {
        console.warn('Error disposing global container:', error);
      }
    }

    // Dispose context containers
    for (const [contextName, container] of this.contextContainers) {
      if (container && typeof container.dispose === 'function') {
        try {
          container.dispose();
          // Context container disposed
        } catch (error) {
          console.warn('Error disposing context container:', contextName, error);
        }
      }
    }

    this.disposed = true;
    // Service locator disposed
  }

  /**
   * Detect context from call stack (Phase 2 enhancement)
   */
  private detectContextFromCallStack(): string | undefined {
    try {
      const stack = new Error().stack;
      if (!stack) return undefined;

      // Extract bounded context from file path patterns
      // Look for patterns like: /order-context/, /user-context/, etc.
      const contextMatch = stack.match(/\/([a-zA-Z-]+)-context\//);
      return contextMatch?.[1];
    } catch {
      return undefined;
    }
  }

  /**
   * Ensure service locator is not disposed
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new ContainerDisposedError();
    }
  }
}

/**
 * @llm-summary VytchesDDD class for vytches d d d operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * VytchesDDD class implementing infrastructure service for vytches d d d operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new VytchesDDD();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new VytchesDDD());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class VytchesDDD {
  private static get serviceLocator(): ServiceLocator {
    return ServiceLocator.getInstance();
  }

  /**
   * Primary setup method (like MediatR's AddMediatR)
   */
  static configure(container: IDependencyContainer): void {
    return VytchesDDD.serviceLocator.configure(container);
  }

  /**
   * Optional context registration for DDD scenarios
   */
  static configureContext(contextName: string, container: IDependencyContainer): void {
    VytchesDDD.serviceLocator.configureContext(contextName, container);
  }

  /**
   * Smart resolution: context-aware when available, global otherwise
   */
  static resolve<T>(token: ServiceToken<T>, context?: string): T {
    return VytchesDDD.serviceLocator.resolve<T>(token, context);
  }

  /**
   * Get the global container
   */
  static getGlobalContainer(): IDependencyContainer {
    return VytchesDDD.serviceLocator.getGlobalContainer();
  }

  /**
   * Get a context-specific container
   */
  static getContext(contextName: string): IDependencyContainer | undefined {
    return VytchesDDD.serviceLocator.getContext(contextName);
  }

  /**
   * Get all registered contexts
   */
  static getContexts(): string[] {
    return VytchesDDD.serviceLocator.getContexts();
  }

  /**
   * Check if a service is registered
   */
  static isRegistered<T>(token: ServiceToken<T>, context?: string): boolean {
    return VytchesDDD.serviceLocator.isRegistered<T>(token, context);
  }

  /**
   * Auto-discover and register handlers
   */
  static async discoverAndRegisterHandlers(assemblies?: any[]): Promise<void> {
    return VytchesDDD.serviceLocator.discoverAndRegisterHandlers(assemblies);
  }

  /**
   * Register a handler discovery plugin
   */
  static registerDiscoveryPlugin(plugin: IHandlerDiscoveryPlugin): void {
    VytchesDDD.serviceLocator.registerDiscoveryPlugin(plugin);
  }

  /**
   * Reset the service locator (useful for testing)
   */
  static reset(): void {
    VytchesDDD.serviceLocator.reset();
  }

  /**
   * Dispose of all containers and clean up resources
   */
  static dispose(): void {
    VytchesDDD.serviceLocator.dispose();
  }
}
