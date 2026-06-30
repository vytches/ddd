import { internalLogger } from '@vytches/ddd-contracts';
import {
  CircularDependencyError,
  ContainerDisposedError,
  InvalidRegistrationError,
  ServiceAlreadyRegisteredError,
  ServiceNotFoundError,
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

// D-2/B + OQ-6: stable unique ids for anonymous function tokens (no name).
// WeakMap keeps entries alive only as long as the class is alive.
const anonymousTokenIds = new WeakMap<Function, string>();
let anonymousTokenCounter = 0;

export class SimpleContainer implements IDependencyContainer {
  private readonly services = new Map<string, ServiceDescriptor>();
  private readonly singletonInstances = new Map<string, unknown>();
  private readonly scopedInstances = new Map<string, unknown>();

  // D-2/C: Set for O(1) cycle detection; separate ordered array for DFS error message.
  private readonly resolutionChainSet = new Set<ServiceToken>();
  private readonly resolutionChainOrder: ServiceToken[] = [];

  // D-2/B: per-instance cache for getTokenKey results.
  private readonly tokenKeyCache = new Map<ServiceToken, string>();

  private disposed = false;

  /**
   * Create a new SimpleContainer instance
   */
  constructor(private readonly parentScope?: SimpleContainer) {
    // SimpleContainer created
  }

  /**
   * Resolve a service by token. Throws ServiceNotFoundError when absent.
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
   * ServiceNotFoundError), but still throws CircularDependencyError on cycles and
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
      ...(options?.tags !== undefined && { tags: options.tags }),
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
      ...(options?.tags !== undefined && { tags: options.tags }),
    };

    this.services.set(tokenKey, descriptor);
  }

  /**
   * Register a service instance.
   *
   * D-4: stores the instance only in services[key].instance; does NOT pre-populate
   * singletonInstances. The singleton cache is populated on first resolve(), which
   * keeps getServices()/resolve() byte-for-byte identical to pre-D-4 behaviour.
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
      ...(options?.tags !== undefined && { tags: options.tags }),
    };

    this.services.set(tokenKey, descriptor);
    // D-4: do NOT also store in singletonInstances here.
    // resolveInternal will populate singletonInstances on first resolve.
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
   * Internal resolution logic — throws ServiceNotFoundError when absent.
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

    return this.createInstance<T>(tokenKey, descriptor as ServiceDescriptor<T>, token);
  }

  /**
   * D-3/A: Like resolveInternal but returns undefined when absent instead of throwing.
   */
  private tryResolveInternal<T>(token: ServiceToken<T>): T | undefined {
    const tokenKey = this.getTokenKey(token);
    const descriptor = this.services.get(tokenKey);

    if (!descriptor) {
      if (this.parentScope) {
        return this.parentScope.tryResolve<T>(token);
      }
      return undefined;
    }

    return this.createInstance<T>(tokenKey, descriptor as ServiceDescriptor<T>, token);
  }

  /**
   * Shared instance-creation logic used by both resolveInternal and tryResolveInternal.
   * Handles singleton/scoped caching, factory invocation, and constructor instantiation.
   */
  private createInstance<T>(
    tokenKey: string,
    descriptor: ServiceDescriptor<T>,
    token: ServiceToken<T>
  ): T {
    // Check singleton cache
    if (descriptor.lifetime === ServiceLifetime.Singleton) {
      const cachedInstance = this.singletonInstances.get(tokenKey);
      if (cachedInstance !== undefined) {
        return cachedInstance as T;
      }
    }

    // Check scoped cache
    if (descriptor.lifetime === ServiceLifetime.Scoped) {
      const cachedInstance = this.scopedInstances.get(tokenKey);
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
      this.singletonInstances.set(tokenKey, instance);
    }

    // Cache scoped instances
    if (descriptor.lifetime === ServiceLifetime.Scoped) {
      this.scopedInstances.set(tokenKey, instance);
    }

    return instance;
  }

  /**
   * D-2/B + OQ-6: Get a consistent string key for a service token.
   * - String tokens: returned as-is.
   * - Symbol tokens: Symbol.toString().
   * - Named function/class tokens: use the .name property.
   * - Anonymous function/class tokens (name === ''): assign a stable unique id
   *   via a module-level WeakMap so that two structurally identical but distinct
   *   anonymous classes never collide.
   * Results are memoised per container instance via tokenKeyCache.
   */
  private getTokenKey(token: ServiceToken): string {
    // Fast path: check per-instance memoization cache.
    // Map uses object identity for non-primitive keys, so function tokens are cached
    // correctly without needing special handling here.
    const cached = this.tokenKeyCache.get(token);
    if (cached !== undefined) {
      return cached;
    }

    let key: string;

    if (typeof token === 'string') {
      key = token;
    } else if (typeof token === 'symbol') {
      key = token.toString();
    } else {
      // Function / class token
      const fn = token as Function;
      const name = fn.name;

      if (name) {
        key = name;
      } else {
        // Anonymous function: assign a stable unique id via WeakMap.
        let id = anonymousTokenIds.get(fn);
        if (id === undefined) {
          id = `__anon_${++anonymousTokenCounter}__`;
          anonymousTokenIds.set(fn, id);
        }
        key = id;
      }
    }

    this.tokenKeyCache.set(token, key);
    return key;
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
