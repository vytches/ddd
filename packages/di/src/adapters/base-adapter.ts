// Removed logging dependency for Phase 1 simplification
import type {
  IDependencyContainer,
  ServiceToken,
  Constructor,
  ServiceFactory,
  ServiceDescriptor,
  ServiceRegistrationOptions,
} from '../types';

/**
 * @llm-summary BaseContainerAdapter class for base container adapter operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * BaseContainerAdapter class implementing infrastructure service for base container adapter operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new BaseContainerAdapter();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export abstract class BaseContainerAdapter implements IDependencyContainer {
  // Simple Phase 1 implementation without logging

  /**
   * Resolve a service by token
   */
  abstract resolve<T>(token: ServiceToken<T>): T;

  /**
   * Register a service with the container
   */
  abstract register<T>(
    token: ServiceToken<T>,
    implementation: Constructor<T>,
    options?: ServiceRegistrationOptions
  ): void;

  /**
   * Register a service using a factory function
   */
  abstract registerFactory<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    options?: ServiceRegistrationOptions
  ): void;

  /**
   * Register a service instance
   */
  abstract registerInstance<T>(
    token: ServiceToken<T>,
    instance: T,
    options?: ServiceRegistrationOptions
  ): void;

  /**
   * Check if a service is registered
   */
  abstract isRegistered<T>(token: ServiceToken<T>): boolean;

  /**
   * Get all registered services
   */
  abstract getServices(): ServiceDescriptor[];

  /**
   * Get services by tag
   */
  getServicesByTag(tag: string): ServiceDescriptor[] {
    return this.getServices().filter(service => service.tags?.includes(tag));
  }

  /**
   * Create a scoped container (optional)
   */
  createScope?(context?: string): IDependencyContainer;

  /**
   * Dispose of the container and clean up resources (optional)
   */
  dispose?(): void;

  /**
   * Get a consistent string key for a service token
   */
  protected getTokenKey(token: ServiceToken): string {
    if (typeof token === 'string') {
      return token;
    }

    if (typeof token === 'symbol') {
      return token.toString();
    }

    return token.name || token.toString();
  }

  /**
   * Validate that a token is not null or undefined
   */
  protected validateToken(token: ServiceToken): void {
    if (token === null || token === undefined) {
      throw new Error('Service token cannot be null or undefined');
    }
  }
}
