import { Logger } from '@vytches/ddd-logging';
import 'reflect-metadata';
import { HandlerDiscoveryRegistry } from './discovery/handler-discovery-registry';
import type { HandlerInfo, IHandlerDiscoveryPlugin } from './discovery/handler-discovery.interface';
import {
  ContainerConfigurationError,
  ContainerDisposedError,
  ServiceNotFoundError,
} from './errors';
import type { IDependencyContainer, ServiceToken } from './types';
import { ServiceLifetime } from './types';

export interface IServiceLocator {
  /**
   * Configure the global container
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
   * Auto-discover and register handlers
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

export class ServiceLocator implements IServiceLocator {
  private static instance: ServiceLocator;
  private readonly logger = Logger.forContext('ServiceLocator');
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
  }

  /**
   * Configure a context-specific container
   */
  configureContext(contextName: string, container: IDependencyContainer): void {
    this.ensureNotDisposed();
    if (!contextName) {
      throw new ContainerConfigurationError('Context name cannot be empty');
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

    // Try context-specific container first
    if (context) {
      const contextContainer = this.contextContainers.get(context);
      if (contextContainer && contextContainer.isRegistered(token)) {
        return contextContainer.resolve<T>(token);
      }
    }

    // Fall back to global container
    if (!this.globalContainer) {
      throw new ContainerConfigurationError(
        'No global container configured. Call configure() first.'
      );
    }

    if (!this.globalContainer.isRegistered(token)) {
      throw new ServiceNotFoundError(
        typeof token === 'string' ? token : 'unknown',
        'Service not registered in any container'
      );
    }

    return this.globalContainer.resolve<T>(token);
  }

  /**
   * Get the global container
   */
  getGlobalContainer(): IDependencyContainer {
    this.ensureNotDisposed();
    if (!this.globalContainer) {
      throw new ContainerConfigurationError('No global container configured');
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

    // Check context container first
    if (context) {
      const contextContainer = this.contextContainers.get(context);
      if (contextContainer && contextContainer.isRegistered(token)) {
        return true;
      }
    }

    // Check global container
    return this.globalContainer?.isRegistered(token) ?? false;
  }

  /**
   * Auto-discover and register handlers
   */
  async discoverAndRegisterHandlers(assemblies?: any[]): Promise<void> {
    this.ensureNotDisposed();

    if (!this.globalContainer) {
      throw new ContainerConfigurationError(
        'No global container configured. Call configure() first.'
      );
    }

    // Discover handlers using discovery registry
    const handlers = await this.discoveryRegistry.discoverAllHandlers(assemblies);

    // Register discovered handlers in the global container
    for (const handler of handlers) {
      this.registerHandlerInContainer(handler, this.globalContainer);
    }

    this.logger.info('Discovered and registered handlers', { count: handlers.length });
  }

  /**
   * Register a handler discovery plugin
   */
  registerDiscoveryPlugin(plugin: IHandlerDiscoveryPlugin): void {
    this.ensureNotDisposed();
    this.discoveryRegistry.registerPlugin(plugin);
  }

  /**
   * Register a handler in a container
   */
  private registerHandlerInContainer(handler: HandlerInfo, container: IDependencyContainer): void {
    try {
      // Register the handler class using handlerType as both token and implementation
      container.register(handler.handlerType, handler.handlerType, {
        lifetime: ServiceLifetime.Transient,
      });
    } catch (error) {
      this.logger.warn('Failed to register handler', {
        handlerName: handler.handlerType.name,
        error: String(error),
      });
    }
  }

  /**
   * Reset the service locator (useful for testing)
   */
  reset(): void {
    try {
      // Clear discovery registry
      this.discoveryRegistry.clear();

      // Clear context containers
      this.contextContainers.clear();

      // Clear global container
      this.globalContainer = undefined;

      // Reset disposed flag
      this.disposed = false;

      this.logger.info('ServiceLocator reset completed');
    } catch (error) {
      this.logger.warn('Error during ServiceLocator reset', { error: String(error) });
    }
  }

  /**
   * Dispose of all containers and clean up resources
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    try {
      // Clear discovery registry
      this.discoveryRegistry.clear();

      // Dispose context containers
      for (const [contextName, container] of this.contextContainers) {
        try {
          if (typeof container.dispose === 'function') {
            container.dispose();
          }
        } catch (error) {
          this.logger.warn('Error disposing context container', { contextName, error: String(error) });
        }
      }
      this.contextContainers.clear();

      // Dispose global container
      if (this.globalContainer && typeof this.globalContainer.dispose === 'function') {
        this.globalContainer.dispose();
      }
      this.globalContainer = undefined;

      this.disposed = true;
      this.logger.info('ServiceLocator disposed');
    } catch (error) {
      this.logger.warn('Error during ServiceLocator disposal', { error: String(error) });
      this.disposed = true;
    }
  }

  /**
   * Ensure the service locator is not disposed
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new ContainerDisposedError();
    }
  }
}

/**
 * Global singleton instance for VytchesDDD service locator
 */
export class VytchesDDD {
  private static _serviceLocator: ServiceLocator;

  /**
   * Get the service locator instance
   */
  static get serviceLocator(): ServiceLocator {
    if (!VytchesDDD._serviceLocator) {
      VytchesDDD._serviceLocator = ServiceLocator.getInstance();
    }
    return VytchesDDD._serviceLocator;
  }

  /**
   * Configure the global container
   */
  static configure(container: IDependencyContainer): void {
    VytchesDDD.serviceLocator.configure(container);
  }

  /**
   * Configure a context-specific container
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
  static discoverAndRegisterHandlers(assemblies?: any[]): Promise<void> {
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

// Default export for convenience
export default VytchesDDD;
