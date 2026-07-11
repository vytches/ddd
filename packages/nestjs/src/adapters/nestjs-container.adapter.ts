import { Inject, Injectable, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  BaseContainerAdapter,
  ContainerServiceNotFoundError,
  InvalidRegistrationError,
  ServiceLifetime,
} from '@vytches/ddd-di';
import type {
  Constructor,
  IDependencyContainer,
  ServiceDescriptor,
  ServiceFactory,
  ServiceRegistrationOptions,
  ServiceToken,
} from '@vytches/ddd-di';
import type { ExtendedServiceRegistrationOptions } from '../types/extended';

/**
 * NestJS Container Adapter
 * Bridges NestJS DI system with VytchesDDD service locator
 *
 * VF-030 D1/D2: token identity lives in the Map key itself (ADR-0034).
 * String tokens key by VALUE; function/class and symbol tokens key by
 * REFERENCE — two distinct classes that share a `.name` never collide, and
 * `Symbol('X') !== Symbol('X')` are distinct registrations. Use `Symbol.for()`
 * for tokens that must be shared across module instances (dual ESM/CJS).
 */
@Injectable()
export class NestJSContainerAdapter extends BaseContainerAdapter {
  private readonly services = new Map<ServiceToken, ServiceDescriptor>();
  private readonly singletonInstances = new Map<ServiceToken, unknown>();
  private readonly scopedInstances = new Map<ServiceToken, unknown>();
  private moduleRef?: ModuleRef;

  constructor(@Optional() @Inject(ModuleRef) moduleRef?: ModuleRef) {
    super();
    if (moduleRef) {
      this.moduleRef = moduleRef;
    }
  }

  /**
   * Set or update the ModuleRef
   */
  setModuleRef(moduleRef: ModuleRef): void {
    this.moduleRef = moduleRef;
  }

  /**
   * Resolve a service by token
   *
   * @throws ContainerServiceNotFoundError when the token is not registered
   * @throws InvalidRegistrationError when the registration has no implementation,
   * factory, or instance
   */
  resolve<T>(token: ServiceToken<T>): T {
    // First, try to resolve from NestJS container
    if (this.moduleRef) {
      try {
        // Try to get from NestJS DI
        const nestInstance = this.moduleRef.get(token as ServiceToken<T>, { strict: false });
        if (nestInstance) {
          return nestInstance as T;
        }
      } catch {
        // Continue to internal resolution
      }
    }

    // Then try our internal container — keyed by the token itself (VF-030 D1)
    const descriptor = this.services.get(token);
    if (!descriptor) {
      throw new ContainerServiceNotFoundError(token);
    }

    // Check caches (singleton shared across scopes at creation time,
    // scoped bounded to THIS adapter instance — VF-030 D5)
    if (descriptor.lifetime === ServiceLifetime.Singleton && this.singletonInstances.has(token)) {
      return this.singletonInstances.get(token) as T;
    }
    if (descriptor.lifetime === ServiceLifetime.Scoped && this.scopedInstances.has(token)) {
      return this.scopedInstances.get(token) as T;
    }

    // Create new instance
    let instance: T;
    if (descriptor.instance !== undefined) {
      instance = descriptor.instance as T;
    } else if (descriptor.factory) {
      instance = descriptor.factory(this) as T;
    } else if (descriptor.implementation) {
      instance = this.createInstance(descriptor.implementation as Constructor<T>);
    } else {
      throw new InvalidRegistrationError(token, 'No implementation, factory, or instance provided');
    }

    // Cache singleton instances
    if (descriptor.lifetime === ServiceLifetime.Singleton) {
      this.singletonInstances.set(token, instance);
    }

    // Cache scoped instances (same instance within this scope — VF-030 D5)
    if (descriptor.lifetime === ServiceLifetime.Scoped) {
      this.scopedInstances.set(token, instance);
    }

    return instance;
  }

  /**
   * Register a service with the container
   */
  register<T>(
    token: ServiceToken<T>,
    implementation: Constructor<T>,
    options?: ServiceRegistrationOptions
  ): void {
    this.validateToken(token);

    const descriptor: ServiceDescriptor = {
      token, // VF-030 D8: store the REAL token, never a derived string key
      implementation,
      lifetime: options?.lifetime || ServiceLifetime.Transient,
      tags: options?.tags,
    };

    this.services.set(token, descriptor);

    // If NestJS ModuleRef is available, try to register there too
    const extOptions = options as ExtendedServiceRegistrationOptions;
    if (this.moduleRef && extOptions?.registerInNestJS !== false) {
      this.registerInNestJS(token, implementation, extOptions);
    }
  }

  /**
   * Register a service using a factory function
   */
  registerFactory<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    options?: ServiceRegistrationOptions
  ): void {
    this.validateToken(token);

    const descriptor: ServiceDescriptor = {
      token,
      factory,
      lifetime: options?.lifetime || ServiceLifetime.Transient,
      tags: options?.tags,
    };

    this.services.set(token, descriptor);
  }

  /**
   * Register a service instance
   */
  registerInstance<T>(
    token: ServiceToken<T>,
    instance: T,
    options?: ServiceRegistrationOptions
  ): void {
    this.validateToken(token);

    const descriptor: ServiceDescriptor = {
      token,
      instance,
      lifetime: ServiceLifetime.Singleton, // Instances are always singleton
      tags: options?.tags,
    };

    this.services.set(token, descriptor);
    this.singletonInstances.set(token, instance);
  }

  /**
   * Check if a service is registered
   */
  isRegistered<T>(token: ServiceToken<T>): boolean {
    // Check internal registry
    if (this.services.has(token)) {
      return true;
    }

    // Check NestJS container
    if (this.moduleRef) {
      try {
        this.moduleRef.get(token as ServiceToken<T>, { strict: false });
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Get all registered services
   */
  getServices(): ServiceDescriptor[] {
    return Array.from(this.services.values());
  }

  /**
   * Create a scoped container.
   *
   * The new adapter instance IS the scope boundary (VF-030 D5): all
   * registrations are visible in the scope, already-materialized singleton
   * instances are shared, and the scope starts with a FRESH scoped-instance
   * cache — a Scoped service resolves to a distinct instance per scope.
   */
  override createScope(_context?: string): IDependencyContainer {
    const scopedAdapter = new NestJSContainerAdapter(this.moduleRef);

    this.services.forEach((descriptor, token) => {
      scopedAdapter.services.set(token, descriptor);
    });
    this.singletonInstances.forEach((instance, token) => {
      scopedAdapter.singletonInstances.set(token, instance);
    });
    // scopedInstances intentionally NOT copied — fresh scoped cache per scope

    return scopedAdapter;
  }

  /**
   * Dispose of the container and clean up resources
   */
  override dispose(): void {
    this.services.clear();
    this.singletonInstances.clear();
    this.scopedInstances.clear();
  }

  /**
   * Create an instance of a class with dependency injection.
   *
   * VF-030 D7: constructor dependencies resolve through the inherited
   * throwing `resolveDependency()` — an unregistered dependency throws
   * `ContainerServiceNotFoundError` and a resolution cycle throws
   * `CircularDependencyError`; there is no silent zero-arg fallback.
   */
  private createInstance<T>(constructor: Constructor<T>): T {
    // Get constructor parameters
    const paramTypes: Constructor<unknown>[] =
      Reflect.getMetadata('design:paramtypes', constructor) || [];

    // Resolve dependencies — fail loudly on any unresolvable parameter
    const dependencies = paramTypes.map(paramType =>
      this.resolveDependency(paramType, constructor)
    );

    // Create instance with resolved dependencies
    return new constructor(...dependencies);
  }

  /**
   * Register a service in NestJS DI system
   * This is a simplified version - full implementation would need access to NestJS internals
   */
  private registerInNestJS(
    _token: ServiceToken<unknown>,
    _implementation: Constructor<unknown>,
    _options?: ExtendedServiceRegistrationOptions
  ): void {
    // This would require deeper integration with NestJS
    // For now, we rely on services being registered through NestJS modules
    // The adapter acts as a bridge to access them
  }

  /**
   * Helper to convert VytchesDDD lifetime to NestJS scope
   */
  private getScope(lifetime?: ServiceLifetime): 'DEFAULT' | 'REQUEST' | 'TRANSIENT' {
    switch (lifetime) {
      case ServiceLifetime.Singleton:
        return 'DEFAULT';
      case ServiceLifetime.Scoped:
        return 'REQUEST';
      case ServiceLifetime.Transient:
        return 'TRANSIENT';
      default:
        return 'DEFAULT';
    }
  }
}
