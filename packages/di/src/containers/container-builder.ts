// Removed logging dependency for Phase 1 simplification
import type {
  IContainerBuilder,
  IDependencyContainer,
  ServiceToken,
  Constructor,
  ServiceFactory,
  ServiceRegistrationOptions,
} from '../types';
import { SimpleContainer } from './simple-container';

/**
 * @llm-summary ContainerBuilder class for container builder operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * ContainerBuilder class implementing infrastructure service for container builder operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new ContainerBuilder();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new ContainerBuilder());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
