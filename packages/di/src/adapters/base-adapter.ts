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

/**
 * Returned by {@link BaseContainerAdapter.tryResolve} when a token is not
 * registered.
 *
 * A dedicated sentinel rather than `undefined`/`null`, because both are
 * legitimate resolved values — a container may hold a registration whose value
 * is `undefined`, and conflating that with a miss would turn a working
 * registration into a `ContainerServiceNotFoundError`.
 *
 * @public
 * @since 0.31.0
 */
export const NOT_REGISTERED: unique symbol = Symbol('vytches:di:not-registered');

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
   * Membership index over {@link dependencyResolutionStack}.
   *
   * The array is kept for ordering — `CircularDependencyError` reports the full
   * chain, which a Set cannot express — while this Set answers "is this token
   * already being resolved?" in O(1) instead of the O(n) `Array.includes` scan
   * that ran once per constructor parameter (VP-006c). The two are always
   * mutated together; treat them as one structure.
   */
  private readonly dependencyResolutionSet = new Set<ServiceToken>();

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
    if (this.dependencyResolutionSet.has(param)) {
      throw new CircularDependencyError([...this.dependencyResolutionStack, param]);
    }

    this.dependencyResolutionStack.push(param);
    this.dependencyResolutionSet.add(param);
    try {
      const resolved = this.tryResolve(param);

      if (resolved === NOT_REGISTERED) {
        throw new ContainerServiceNotFoundError(param, describeToken(ownerToken));
      }

      return resolved;
    } finally {
      this.dependencyResolutionStack.pop();
      this.dependencyResolutionSet.delete(param);
    }
  }

  /**
   * Miss-tolerant resolution: return the service, or {@link NOT_REGISTERED} if
   * this container does not have it.
   *
   * Exists so {@link resolveDependency} can answer "registered?" and "give me
   * the instance" in **one** pass. The default implementation preserves the
   * previous two-pass behaviour exactly — `isRegistered()` then `resolve()` —
   * so a subclass that overrides only `resolve()` is unaffected and needs no
   * changes.
   *
   * Override it when the underlying container exposes a cheaper native lookup
   * that reports a miss without throwing. A framework-backed adapter otherwise
   * pays two framework lookups (or one wasted throw/catch) per constructor
   * parameter — the cost VP-006b measured and fixed adapter-locally for
   * `NestJSContainerAdapter`; this hook generalises that fix to every adapter
   * built on this base class.
   *
   * An override MUST return {@link NOT_REGISTERED} for a miss rather than
   * throwing or returning `undefined`: `undefined` is a legitimate resolved
   * value, and only the sentinel distinguishes the two.
   *
   * @param token - Token to resolve
   * @returns The resolved service, or {@link NOT_REGISTERED}
   */
  protected tryResolve<T>(token: ServiceToken<T>): T | typeof NOT_REGISTERED {
    return this.isRegistered(token) ? this.resolve(token) : NOT_REGISTERED;
  }
}
