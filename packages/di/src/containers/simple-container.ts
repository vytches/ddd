import { internalLogger } from '@vytches/ddd-contracts/internal';
import {
  CircularDependencyError,
  ContainerDisposedError,
  InvalidRegistrationError,
  ServiceAlreadyRegisteredError,
  ContainerServiceNotFoundError,
} from '../errors';
import type {
  Constructor,
  IDependencyContainer,
  ServiceDescriptor,
  ServiceFactory,
  ServiceRegistrationOptions,
  ServiceToken,
} from '../types';
import { ServiceLifetime } from '../types';

export class SimpleContainer implements IDependencyContainer {
  // VF-030 D1: token identity lives in the Map key itself (ADR-0034).
  // String tokens key by VALUE; function/class and symbol tokens key by
  // REFERENCE — two distinct classes that share a .name never collide, and
  // Symbol('X') !== Symbol('X') are distinct registrations. Use Symbol.for()
  // for tokens that must be shared across module instances (dual ESM/CJS).
  private readonly services = new Map<ServiceToken, ServiceDescriptor>();
  private readonly singletonInstances = new Map<ServiceToken, unknown>();
  private readonly scopedInstances = new Map<ServiceToken, unknown>();

  // D-2/C: Set for O(1) cycle detection; separate ordered array for DFS error message.
  private readonly resolutionChainSet = new Set<ServiceToken>();
  private readonly resolutionChainOrder: ServiceToken[] = [];

  private disposed = false;

  /**
   * Create a new SimpleContainer instance
   */
  constructor(private readonly parentScope?: SimpleContainer) {
    // SimpleContainer created
  }

  /**
   * Resolve a service by token. Throws ContainerServiceNotFoundError when absent.
   */
  resolve<T>(token: ServiceToken<T>): T {
    this.ensureNotDisposed();

    // D-2/C: O(1) cycle detection via Set
    if (this.resolutionChainSet.has(token)) {
      throw new CircularDependencyError([...this.resolutionChainOrder, token]);
    }

    this.resolutionChainSet.add(token);
    this.resolutionChainOrder.push(token);

    try {
      return this.resolveInternal<T>(token);
    } finally {
      // Symmetric delete — preserves DFS ordering for subsequent cycles
      this.resolutionChainSet.delete(token);
      this.resolutionChainOrder.pop();
    }
  }

  /**
   * D-3/A: Try to resolve a service. Returns undefined when absent (never throws
   * ContainerServiceNotFoundError), but still throws CircularDependencyError on cycles and
   * still walks the parent scope.
   */
  tryResolve<T>(token: ServiceToken<T>): T | undefined {
    this.ensureNotDisposed();

    if (this.resolutionChainSet.has(token)) {
      throw new CircularDependencyError([...this.resolutionChainOrder, token]);
    }

    this.resolutionChainSet.add(token);
    this.resolutionChainOrder.push(token);

    try {
      return this.tryResolveInternal<T>(token);
    } finally {
      this.resolutionChainSet.delete(token);
      this.resolutionChainOrder.pop();
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

    if (!implementation) {
      throw new InvalidRegistrationError(token, 'Implementation cannot be null or undefined');
    }

    if (this.services.has(token)) {
      throw new ServiceAlreadyRegisteredError(token, options?.context);
    }

    const descriptor: ServiceDescriptor<T> = {
      token,
      implementation,
      lifetime: options?.lifetime || ServiceLifetime.Transient,
      ...(options?.context !== undefined && { context: options.context }),
      ...(options?.tags !== undefined && { tags: options.tags }),
    };

    this.services.set(token, descriptor);
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

    if (!factory) {
      throw new InvalidRegistrationError(token, 'Factory cannot be null or undefined');
    }

    if (this.services.has(token)) {
      throw new ServiceAlreadyRegisteredError(token, options?.context);
    }

    const descriptor: ServiceDescriptor<T> = {
      token,
      factory,
      lifetime: options?.lifetime || ServiceLifetime.Transient,
      ...(options?.context !== undefined && { context: options.context }),
      ...(options?.tags !== undefined && { tags: options.tags }),
    };

    this.services.set(token, descriptor);
  }

  /**
   * Register a service instance.
   *
   * D-4: stores the instance only in services[token].instance; does NOT pre-populate
   * singletonInstances. The singleton cache is populated on first resolve(), which
   * keeps getServices()/resolve() byte-for-byte identical to pre-D-4 behaviour.
   */
  registerInstance<T>(
    token: ServiceToken<T>,
    instance: T,
    options?: ServiceRegistrationOptions
  ): void {
    this.ensureNotDisposed();

    if (instance === null || instance === undefined) {
      throw new InvalidRegistrationError(token, 'Instance cannot be null or undefined');
    }

    if (this.services.has(token)) {
      throw new ServiceAlreadyRegisteredError(token, options?.context);
    }

    const descriptor: ServiceDescriptor<T> = {
      token,
      instance,
      lifetime: ServiceLifetime.Singleton, // Instance registrations are always singleton
      ...(options?.context !== undefined && { context: options.context }),
      ...(options?.tags !== undefined && { tags: options.tags }),
    };

    this.services.set(token, descriptor);
    // D-4: do NOT also store in singletonInstances here.
    // resolveInternal will populate singletonInstances on first resolve.
  }

  /**
   * Check if a service is registered
   */
  isRegistered<T>(token: ServiceToken<T>): boolean {
    this.ensureNotDisposed();
    return this.services.has(token) || (this.parentScope?.isRegistered(token) ?? false);
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
      if (
        instance &&
        typeof instance === 'object' &&
        'dispose' in instance &&
        typeof (instance as { dispose: unknown }).dispose === 'function'
      ) {
        try {
          (instance as { dispose: () => void }).dispose();
        } catch (error) {
          internalLogger.warn('SimpleContainer: Error disposing singleton instance', {
            error: String(error),
          });
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
   * Internal resolution logic — throws ContainerServiceNotFoundError when absent.
   */
  private resolveInternal<T>(token: ServiceToken<T>): T {
    const descriptor = this.services.get(token);

    if (!descriptor) {
      // Try parent scope if available
      if (this.parentScope) {
        return this.parentScope.resolve<T>(token);
      }
      throw new ContainerServiceNotFoundError(token);
    }

    return this.createInstance<T>(descriptor as ServiceDescriptor<T>, token);
  }

  /**
   * D-3/A: Like resolveInternal but returns undefined when absent instead of throwing.
   */
  private tryResolveInternal<T>(token: ServiceToken<T>): T | undefined {
    const descriptor = this.services.get(token);

    if (!descriptor) {
      if (this.parentScope) {
        return this.parentScope.tryResolve<T>(token);
      }
      return undefined;
    }

    return this.createInstance<T>(descriptor as ServiceDescriptor<T>, token);
  }

  /**
   * Shared instance-creation logic used by both resolveInternal and tryResolveInternal.
   * Handles singleton/scoped caching, factory invocation, and constructor instantiation.
   * Caches are keyed by the token itself (reference identity — VF-030 D1).
   */
  private createInstance<T>(descriptor: ServiceDescriptor<T>, token: ServiceToken<T>): T {
    // Check singleton cache
    if (descriptor.lifetime === ServiceLifetime.Singleton) {
      const cachedInstance = this.singletonInstances.get(token);
      if (cachedInstance !== undefined) {
        return cachedInstance as T;
      }
    }

    // Check scoped cache
    if (descriptor.lifetime === ServiceLifetime.Scoped) {
      const cachedInstance = this.scopedInstances.get(token);
      if (cachedInstance !== undefined) {
        return cachedInstance as T;
      }
    }

    // Create new instance
    let instance: T;

    if (descriptor.instance !== undefined) {
      instance = descriptor.instance as T;
    } else if (descriptor.factory) {
      instance = descriptor.factory(this) as T;
    } else if (descriptor.implementation) {
      instance = new descriptor.implementation() as T;
    } else {
      throw new InvalidRegistrationError(token, 'No implementation, factory, or instance provided');
    }

    // Cache singleton instances
    if (descriptor.lifetime === ServiceLifetime.Singleton) {
      this.singletonInstances.set(token, instance);
    }

    // Cache scoped instances
    if (descriptor.lifetime === ServiceLifetime.Scoped) {
      this.scopedInstances.set(token, instance);
    }

    return instance;
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
