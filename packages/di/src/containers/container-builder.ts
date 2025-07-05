// Removed logging dependency for Phase 1 simplification
import type {
  IContainerBuilder,
  IDependencyContainer,
  ServiceToken,
  Constructor,
  ServiceFactory,
  ServiceRegistrationOptions
} from '../types';
import { SimpleContainer } from './simple-container';

/**
 * Builder for fluent container configuration
 */
export class ContainerBuilder implements IContainerBuilder {
  // Simple Phase 1 implementation without logging
  private readonly container: SimpleContainer;

  constructor() {
    this.container = new SimpleContainer();
    // ContainerBuilder created
  }

  /**
   * Register a service
   */
  register<T>(
    token: ServiceToken<T>,
    implementation: Constructor<T>,
    options?: ServiceRegistrationOptions
  ): IContainerBuilder {
    // Registering service with builder

    this.container.register(token, implementation, options);
    return this;
  }

  /**
   * Register a service factory
   */
  registerFactory<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    options?: ServiceRegistrationOptions
  ): IContainerBuilder {
    // Registering service factory with builder

    this.container.registerFactory(token, factory, options);
    return this;
  }

  /**
   * Register a service instance
   */
  registerInstance<T>(
    token: ServiceToken<T>,
    instance: T,
    options?: ServiceRegistrationOptions
  ): IContainerBuilder {
    // Registering service instance with builder

    this.container.registerInstance(token, instance, options);
    return this;
  }

  /**
   * Build the container
   */
  build(): IDependencyContainer {
    // Building container

    return this.container;
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
}
