// Removed logging dependency for Phase 1 simplification
import {
  CircularDependencyError,
  ContainerServiceNotFoundError,
  InvalidRegistrationError,
} from '../errors';
import { describeToken } from '../internal/token-key';
import type {
  Constructor,
  IDependencyContainer,
  ServiceDescriptor,
  ServiceFactory,
  ServiceRegistrationOptions,
  ServiceToken,
} from '../types';

export abstract class BaseContainerAdapter implements IDependencyContainer {
  // Simple Phase 1 implementation without logging

  /**
   * Tokens currently being resolved through {@link resolveDependency}.
   * Used to detect circular constructor dependencies. Tokens are tracked
   * by reference (strings by value), consistent with container identity
   * semantics (see ADR-0034): identity is the token itself, never a
   * derived string key.
   */
  private readonly dependencyResolutionStack: ServiceToken[] = [];

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
   * Get a human-readable string for a service token.
   *
   * @deprecated Token identity is now the token REFERENCE itself — containers
   * key their maps by `ServiceToken` directly (functions and symbols by
   * reference, strings by value), never by a derived string. This method is
   * kept only as a display helper for subclasses that use it in error
   * messages or logs; it delegates to the internal `describeToken()` and its
   * output is intentionally lossy. Do NOT use the returned string as a lookup
   * key. See `packages/di/FRAMEWORK-ADAPTERS.md` for migration guidance.
   */
  protected getTokenKey(token: ServiceToken): string {
    return describeToken(token);
  }

  /**
   * Validate that a token is not null or undefined.
   *
   * @throws InvalidRegistrationError when the token is null or undefined
   */
  protected validateToken(token: ServiceToken): void {
    if (token === null || token === undefined) {
      throw new InvalidRegistrationError(
        describeToken(token),
        'Service token cannot be null or undefined'
      );
    }
  }

  /**
   * Resolve a constructor dependency of `ownerToken`, failing loudly.
   *
   * Unlike a plain `resolve()` call, this helper never falls back to silently
   * constructing an instance: an unregistered dependency throws
   * `ContainerServiceNotFoundError` (with the owning service as context) and
   * a circular constructor dependency throws `CircularDependencyError` with
   * the full resolution chain.
   *
   * @param param - Token of the dependency to resolve
   * @param ownerToken - Token of the service whose constructor requires it
   * @throws ContainerServiceNotFoundError when the dependency is not registered
   * @throws CircularDependencyError when a resolution cycle is detected
   */
  protected resolveDependency<T>(param: ServiceToken<T>, ownerToken: ServiceToken): T {
    if (this.dependencyResolutionStack.includes(param)) {
      throw new CircularDependencyError([...this.dependencyResolutionStack, param]);
    }

    if (!this.isRegistered(param)) {
      throw new ContainerServiceNotFoundError(param, describeToken(ownerToken));
    }

    this.dependencyResolutionStack.push(param);
    try {
      return this.resolve(param);
    } finally {
      this.dependencyResolutionStack.pop();
    }
  }
}
