import { Injectable, type Type } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import type {
  Constructor,
  IDependencyContainer,
  ServiceDescriptor,
  ServiceFactory,
  ServiceLifetime,
  ServiceRegistrationOptions,
  ServiceToken,
} from '@vytches/ddd-di';
import type { ExtendedServiceRegistrationOptions } from '../types/extended';

/**
 * NestJS Container Adapter
 * Bridges NestJS DI system with VytchesDDD service locator
 */
@Injectable()
export class NestJSContainerAdapter implements IDependencyContainer {
  private readonly services = new Map<string, ServiceDescriptor>();
  private readonly instances = new Map<string, object>();
  private moduleRef?: ModuleRef;

  constructor(moduleRef?: ModuleRef) {
    if (moduleRef) {
      this.moduleRef = moduleRef;
    }
  }

  /**
   * Get string key from service token
   */
  private getTokenKey<T>(token: ServiceToken<T>): string {
    if (typeof token === 'string') {
      return token;
    }
    if (typeof token === 'symbol') {
      return token.toString();
    }
    return token.name || token.toString();
  }

  /**
   * Set or update the ModuleRef
   */
  setModuleRef(moduleRef: ModuleRef): void {
    this.moduleRef = moduleRef;
  }

  /**
   * Resolve a service by token
   */
  resolve<T>(token: ServiceToken<T>): T {
    const key = this.getTokenKey(token);

    // First, try to resolve from NestJS container
    if (this.moduleRef) {
      try {
        // Try to get from NestJS DI
        const nestInstance = this.moduleRef.get(token as string | symbol | Type<object>, {
          strict: false,
        });
        if (nestInstance) {
          return nestInstance as T;
        }
      } catch {
        // Continue to internal resolution
      }
    }

    // Then try our internal container
    const descriptor = this.services.get(key);
    if (!descriptor) {
      throw new Error(`Service '${key}' not found in container`);
    }

    // Check if we have a cached instance (for singletons)
    if (descriptor.lifetime === 'singleton' && this.instances.has(key)) {
      return this.instances.get(key) as T;
    }

    // Create new instance
    let instance: T;
    if (descriptor.factory) {
      instance = descriptor.factory(this) as T;
    } else if (descriptor.instance) {
      instance = descriptor.instance as T;
    } else if (descriptor.implementation) {
      instance = this.createInstance(descriptor.implementation as Constructor<T>);
    } else {
      throw new Error(`Cannot resolve service '${key}': no implementation provided`);
    }

    // Cache singleton instances
    if (descriptor.lifetime === 'singleton') {
      this.instances.set(key, instance as object);
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
    const key = this.getTokenKey(token);

    const descriptor: ServiceDescriptor = {
      token: key,
      implementation,
      lifetime: options?.lifetime || ('transient' as ServiceLifetime),
      tags: options?.tags,
    };

    this.services.set(key, descriptor);

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
    const key = this.getTokenKey(token);

    const descriptor: ServiceDescriptor = {
      token: key,
      factory,
      lifetime: options?.lifetime || ('transient' as ServiceLifetime),
      tags: options?.tags,
    };

    this.services.set(key, descriptor);
  }

  /**
   * Register a service instance
   */
  registerInstance<T>(
    token: ServiceToken<T>,
    instance: T,
    options?: ServiceRegistrationOptions
  ): void {
    const key = this.getTokenKey(token);

    const descriptor: ServiceDescriptor = {
      token: key,
      instance,
      lifetime: 'singleton' as ServiceLifetime, // Instances are always singleton
      tags: options?.tags,
    };

    this.services.set(key, descriptor);
    this.instances.set(key, instance as object);
  }

  /**
   * Check if a service is registered
   */
  isRegistered<T>(token: ServiceToken<T>): boolean {
    const key = this.getTokenKey(token);

    // Check internal registry
    if (this.services.has(key)) {
      return true;
    }

    // Check NestJS container
    if (this.moduleRef) {
      try {
        this.moduleRef.get(token as string | symbol | Type<object>, { strict: false });
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
   * Get services by tag
   */
  getServicesByTag(tag: string): ServiceDescriptor[] {
    return Array.from(this.services.values()).filter(
      service => service.tags && service.tags.includes(tag)
    );
  }

  /**
   * Create a scoped container
   */
  createScope(_context?: string): IDependencyContainer {
    // Create a new adapter with the same ModuleRef but separate registrations
    const scopedAdapter = new NestJSContainerAdapter(this.moduleRef);

    // Copy singleton services to the scoped container
    this.services.forEach((descriptor, key) => {
      if (descriptor.lifetime === 'singleton') {
        scopedAdapter.services.set(key, descriptor);
        if (this.instances.has(key)) {
          scopedAdapter.instances.set(key, this.instances.get(key) as object);
        }
      }
    });

    return scopedAdapter;
  }

  /**
   * Dispose of the container and clean up resources
   */
  dispose(): void {
    this.services.clear();
    this.instances.clear();
  }

  /**
   * Create an instance of a class with dependency injection
   */
  private createInstance<T>(constructor: Constructor<T>): T {
    // Get constructor parameters
    const paramTypes = Reflect.getMetadata('design:paramtypes', constructor) || [];

    // Resolve dependencies
    const dependencies = paramTypes.map((paramType: Constructor<object>) => {
      try {
        return this.resolve(paramType);
      } catch {
        // If we can't resolve, try to create a new instance
        return new paramType();
      }
    });

    // Create instance with resolved dependencies
    return new constructor(...dependencies);
  }

  /**
   * Register a service in NestJS DI system
   * This is a simplified version - full implementation would need access to NestJS internals
   */
  private registerInNestJS<T>(
    _token: ServiceToken<T>,
    _implementation: Constructor<T>,
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
      case 'singleton':
        return 'DEFAULT';
      case 'scoped':
        return 'REQUEST';
      case 'transient':
        return 'TRANSIENT';
      default:
        return 'DEFAULT';
    }
  }
}
