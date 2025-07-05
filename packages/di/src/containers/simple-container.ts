// Removed logging dependency for Phase 1 simplification
import type {
  IDependencyContainer,
  ServiceToken,
  Constructor,
  ServiceFactory,
  ServiceDescriptor,
  ServiceRegistrationOptions
} from '../types';
import { ServiceLifetime } from '../types';
import {
  ServiceNotFoundError,
  InvalidRegistrationError,
  ServiceAlreadyRegisteredError,
  CircularDependencyError,
  ContainerDisposedError
} from '../errors';

/**
 * Simple in-memory dependency container implementation
 * Provides basic dependency injection capabilities for testing and simple scenarios
 */
export class SimpleContainer implements IDependencyContainer {
  private readonly services = new Map<string, ServiceDescriptor>();
  private readonly singletonInstances = new Map<string, any>();
  private readonly scopedInstances = new Map<string, any>();
  private readonly resolutionChain: ServiceToken[] = [];
  private disposed = false;

  /**
   * Create a new SimpleContainer instance
   */
  constructor(private readonly parentScope?: SimpleContainer) {
    // SimpleContainer created
  }

  /**
   * Resolve a service by token
   */
  resolve<T>(token: ServiceToken<T>): T {
    this.ensureNotDisposed();

    // Check for circular dependencies
    if (this.resolutionChain.includes(token)) {
      throw new CircularDependencyError([...this.resolutionChain, token]);
    }

    // Add to resolution chain
    this.resolutionChain.push(token);

    try {
      const instance = this.resolveInternal<T>(token);
      return instance;
    } finally {
      // Remove from resolution chain
      this.resolutionChain.pop();
    }
  }

  /**
   * Register a service with the container
   */
  register<T>(
    token: ServiceToken<T>,
    implementation: Constructor<T>,
    options?: ServiceRegistrationOptions
  ): void {
    this.ensureNotDisposed();

    const tokenKey = this.getTokenKey(token);

    if (!implementation) {
      throw new InvalidRegistrationError(token, 'Implementation cannot be null or undefined');
    }

    if (this.services.has(tokenKey)) {
      throw new ServiceAlreadyRegisteredError(token, options?.context);
    }

    const descriptor: ServiceDescriptor<T> = {
      token,
      implementation,
      lifetime: options?.lifetime || ServiceLifetime.Transient,
      ...(options?.context !== undefined && { context: options.context }),
      ...(options?.tags !== undefined && { tags: options.tags })
    };

    this.services.set(tokenKey, descriptor);
  }

  /**
   * Register a service using a factory function
   */
  registerFactory<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    options?: ServiceRegistrationOptions
  ): void {
    this.ensureNotDisposed();

    const tokenKey = this.getTokenKey(token);

    if (!factory) {
      throw new InvalidRegistrationError(token, 'Factory cannot be null or undefined');
    }

    if (this.services.has(tokenKey)) {
      throw new ServiceAlreadyRegisteredError(token, options?.context);
    }

    const descriptor: ServiceDescriptor<T> = {
      token,
      factory,
      lifetime: options?.lifetime || ServiceLifetime.Transient,
      ...(options?.context !== undefined && { context: options.context }),
      ...(options?.tags !== undefined && { tags: options.tags })
    };

    this.services.set(tokenKey, descriptor);
  }

  /**
   * Register a service instance
   */
  registerInstance<T>(
    token: ServiceToken<T>,
    instance: T,
    options?: ServiceRegistrationOptions
  ): void {
    this.ensureNotDisposed();

    const tokenKey = this.getTokenKey(token);

    if (instance === null || instance === undefined) {
      throw new InvalidRegistrationError(token, 'Instance cannot be null or undefined');
    }

    if (this.services.has(tokenKey)) {
      throw new ServiceAlreadyRegisteredError(token, options?.context);
    }

    const descriptor: ServiceDescriptor<T> = {
      token,
      instance,
      lifetime: ServiceLifetime.Singleton, // Instance registrations are always singleton
      ...(options?.context !== undefined && { context: options.context }),
      ...(options?.tags !== undefined && { tags: options.tags })
    };

    this.services.set(tokenKey, descriptor);
    this.singletonInstances.set(tokenKey, instance);
  }

  /**
   * Check if a service is registered
   */
  isRegistered<T>(token: ServiceToken<T>): boolean {
    this.ensureNotDisposed();
    const tokenKey = this.getTokenKey(token);
    return this.services.has(tokenKey) || (this.parentScope?.isRegistered(token) ?? false);
  }

  /**
   * Get all registered services
   */
  getServices(): ServiceDescriptor[] {
    this.ensureNotDisposed();
    const services = Array.from(this.services.values());
    const parentServices = this.parentScope?.getServices() ?? [];
    return [...services, ...parentServices];
  }

  /**
   * Get services by tag
   */
  getServicesByTag(tag: string): ServiceDescriptor[] {
    this.ensureNotDisposed();
    return this.getServices().filter(service => service.tags?.includes(tag) ?? false);
  }

  /**
   * Create a scoped container
   */
  createScope(_context?: string): IDependencyContainer {
    this.ensureNotDisposed();
    return new SimpleContainer(this);
  }

  /**
   * Dispose of the container and clean up resources
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    // Dispose singleton instances if they implement dispose
    for (const [, instance] of this.singletonInstances) {
      if (instance && typeof instance.dispose === 'function') {
        try {
          instance.dispose();
        } catch (error) {
          console.warn('Error disposing singleton instance:', error);
        }
      }
    }

    // Clear all maps
    this.services.clear();
    this.singletonInstances.clear();
    this.scopedInstances.clear();

    this.disposed = true;
  }

  /**
   * Internal resolution logic
   */
  private resolveInternal<T>(token: ServiceToken<T>): T {
    const tokenKey = this.getTokenKey(token);
    const descriptor = this.services.get(tokenKey);

    if (!descriptor) {
      // Try parent scope if available
      if (this.parentScope) {
        return this.parentScope.resolve<T>(token);
      }
      throw new ServiceNotFoundError(token);
    }

    // Check singleton cache
    if (descriptor.lifetime === ServiceLifetime.Singleton) {
      const cachedInstance = this.singletonInstances.get(tokenKey);
      if (cachedInstance) {
        return cachedInstance;
      }
    }

    // Check scoped cache
    if (descriptor.lifetime === ServiceLifetime.Scoped) {
      const cachedInstance = this.scopedInstances.get(tokenKey);
      if (cachedInstance) {
        return cachedInstance;
      }
    }

    // Create new instance
    let instance: T;

    if (descriptor.instance !== undefined) {
      instance = descriptor.instance;
    } else if (descriptor.factory) {
      instance = descriptor.factory(this);
    } else if (descriptor.implementation) {
      instance = new descriptor.implementation();
    } else {
      throw new InvalidRegistrationError(token, 'No implementation, factory, or instance provided');
    }

    // Cache singleton instances
    if (descriptor.lifetime === ServiceLifetime.Singleton) {
      this.singletonInstances.set(tokenKey, instance);
    }

    // Cache scoped instances
    if (descriptor.lifetime === ServiceLifetime.Scoped) {
      this.scopedInstances.set(tokenKey, instance);
    }

    return instance;
  }

  /**
   * Get a consistent string key for a service token
   */
  private getTokenKey(token: ServiceToken): string {
    if (typeof token === 'string') {
      return token;
    }

    if (typeof token === 'symbol') {
      return token.toString();
    }

    return token.name || token.toString();
  }

  /**
   * Ensure container is not disposed
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new ContainerDisposedError();
    }
  }
}