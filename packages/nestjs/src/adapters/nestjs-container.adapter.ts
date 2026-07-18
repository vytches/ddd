import { Inject, Injectable, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { internalLogger } from '@vytches/ddd-contracts/internal';
// eslint-disable-next-line @nx/enforce-module-boundaries -- @vytches/ddd-di is a real static dependency here (base class, thrown error types, ServiceLifetime enum), not lazy-loaded
import {
  BaseContainerAdapter,
  CircularDependencyError,
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
 * Sentinel returned by the internal miss-tolerant resolution path when a
 * token is found neither in the internal registry nor in the NestJS
 * container. Module-private — never leaves this file.
 */
const NOT_RESOLVED: unique symbol = Symbol('vytches.ddd.nestjs.not-resolved');

/**
 * Lazy-once reflection cache (VP-006b / D-1): `design:paramtypes` is read via
 * `Reflect.getMetadata` exactly ONCE per constructor — on the FIRST
 * instantiation, never at `register()` time — and reused for every later
 * instantiation. Empty results are cached as empty arrays.
 * Paramtypes metadata is immutable after class definition, so there is no
 * invalidation; the WeakMap lets constructors be garbage-collected.
 */
const paramTypesCache = new WeakMap<Constructor<unknown>, readonly Constructor<unknown>[]>();

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
  /**
   * VP-006b (OQ-2) copy-on-write: `services` and `singletonInstances` may be
   * SHARED by reference with adapters created via {@link createScope}. The
   * matching `*Shared` flag marks a map as potentially backing another
   * adapter's snapshot; every mutation path forks the map first (see
   * {@link forkServicesIfShared} / {@link forkSingletonInstancesIfShared}),
   * so a mutation on one side never leaks into the other side's snapshot.
   * `scopedInstances` is always adapter-private and never shared (VF-030 D5).
   */
  private services = new Map<ServiceToken, ServiceDescriptor>();
  private servicesShared = false;
  private singletonInstances = new Map<ServiceToken, unknown>();
  private singletonInstancesShared = false;
  private readonly scopedInstances = new Map<ServiceToken, unknown>();
  private moduleRef?: ModuleRef;

  /**
   * Tokens currently being resolved through {@link resolveDependency}.
   * Kept locally because the base class stack is private (VP-006b / D-3);
   * error type and chain semantics are identical to the base implementation.
   */
  private readonly resolutionChain: ServiceToken[] = [];

  /**
   * Tokens already probed by the dev-only dual-registration divergence
   * guard — each token is probed against the NestJS container at most once
   * per adapter instance (VP-006b / OQ-4 post-audit condition).
   */
  private readonly divergenceProbedTokens = new Set<ServiceToken>();

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
   * Resolve a service by token.
   *
   * VP-006b (OQ-1/A) — REGISTRY-FIRST with ModuleRef fallback: tokens
   * registered on this adapter resolve internally (caches/lifetimes as
   * before) without touching `ModuleRef.get`; only tokens the adapter does
   * NOT own fall back to the NestJS container, exactly as before. For a
   * token registered in BOTH containers the INTERNAL registration now wins
   * (behavior change — see CHANGELOG); a dev-only guard warns once per
   * token when the two would diverge.
   *
   * @throws ContainerServiceNotFoundError when the token is not registered
   * @throws InvalidRegistrationError when the registration has no implementation,
   * factory, or instance
   */
  resolve<T>(token: ServiceToken<T>): T {
    const result = this.resolveOrMiss(token);
    if (result === NOT_RESOLVED) {
      throw new ContainerServiceNotFoundError(token);
    }
    return result;
  }

  /**
   * Single-pass resolution shared by {@link resolve} and
   * {@link resolveDependency}: internal registry first, then the NestJS
   * container. Returns the {@link NOT_RESOLVED} sentinel instead of throwing
   * on a miss so each caller can raise `ContainerServiceNotFoundError` with
   * its own context (plain vs. owner-scoped) without a double lookup.
   */
  private resolveOrMiss<T>(token: ServiceToken<T>): T | typeof NOT_RESOLVED {
    // Internal container first — keyed by the token itself (VF-030 D1)
    const descriptor = this.services.get(token);
    if (descriptor) {
      const instance = this.resolveInternal<T>(token, descriptor);
      this.warnOnDualRegistrationDivergence(token, instance);
      return instance;
    }

    // Fallback: NestJS DI for tokens the adapter does not own
    if (this.moduleRef) {
      try {
        const nestInstance = this.moduleRef.get(token as ServiceToken<T>, { strict: false });
        if (nestInstance) {
          return nestInstance as T;
        }
      } catch {
        // Not found in NestJS either — fall through to the sentinel
      }
    }

    return NOT_RESOLVED;
  }

  /**
   * Resolve a token that IS present in the internal registry, honoring
   * lifetime caches (VF-030 D5) — byte-for-byte the pre-VP-006b internal
   * branch of `resolve()`.
   */
  private resolveInternal<T>(token: ServiceToken<T>, descriptor: ServiceDescriptor): T {
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

    // Cache singleton instances (fork first — a singleton materialized
    // AFTER a scope split must stay invisible to the other side's snapshot)
    if (descriptor.lifetime === ServiceLifetime.Singleton) {
      this.forkSingletonInstancesIfShared();
      this.singletonInstances.set(token, instance);
    }

    // Cache scoped instances (same instance within this scope — VF-030 D5)
    if (descriptor.lifetime === ServiceLifetime.Scoped) {
      this.scopedInstances.set(token, instance);
    }

    return instance;
  }

  /**
   * Dev-only dual-registration divergence guard (VP-006b post-audit
   * condition): on the FIRST internal-registry hit for a token, probe the
   * NestJS container once; if NestJS would have produced a DIFFERENT
   * instance, warn (once per token per adapter instance) that registry-first
   * resolution changed which instance wins. Never throws; entirely skipped
   * when NODE_ENV === 'production', so the production hot path pays only
   * the env check.
   */
  private warnOnDualRegistrationDivergence(token: ServiceToken, internalInstance: unknown): void {
    if (process.env.NODE_ENV === 'production') {
      return;
    }
    if (!this.moduleRef || this.divergenceProbedTokens.has(token)) {
      return;
    }
    this.divergenceProbedTokens.add(token);

    try {
      const nestInstance = this.moduleRef.get(token as ServiceToken, { strict: false });
      if (
        nestInstance !== undefined &&
        nestInstance !== null &&
        nestInstance !== internalInstance
      ) {
        internalLogger.warn(
          'NestJSContainerAdapter: token is registered in BOTH the internal registry and the ' +
            'NestJS container with different instances; registry-first resolution (VP-006b) ' +
            'returns the INTERNAL registration. Remove one of the two registrations.',
          { token: this.getTokenKey(token) }
        );
      }
    } catch {
      // Token is not resolvable through NestJS — no dual registration.
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
    this.validateToken(token);

    const descriptor: ServiceDescriptor = {
      token, // VF-030 D8: store the REAL token, never a derived string key
      implementation,
      lifetime: options?.lifetime || ServiceLifetime.Transient,
      tags: options?.tags,
    };

    this.forkServicesIfShared();
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

    this.forkServicesIfShared();
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

    this.forkServicesIfShared();
    this.services.set(token, descriptor);
    this.forkSingletonInstancesIfShared();
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
   * The new adapter instance IS the scope boundary (VF-030 D5): the scope
   * sees a SNAPSHOT of the parent's registrations and materialized singleton
   * instances as of creation time — registrations added to the parent AFTER
   * this call are invisible in the scope (and vice versa) — and the scope
   * starts with a FRESH scoped-instance cache, so a Scoped service resolves
   * to a distinct instance per scope.
   *
   * VP-006b (OQ-2, measured MATERIAL — 56.62 KB retained per live scope at
   * N=1000 registered services under the previous eager dual-Map copy): the
   * snapshot is COPY-ON-WRITE. This call is O(1) — parent and scope share
   * the `services` and `singletonInstances` maps by REFERENCE, and the
   * first mutation on either side (a new registration, or materializing a
   * not-yet-cached singleton) forks the mutating side's map, leaving the
   * other side's snapshot untouched. `dispose()` drops map references
   * instead of clearing shared maps, so disposing a scope never clears the
   * parent's maps (and disposing the parent never clears a live scope's
   * snapshot).
   */
  override createScope(_context?: string): IDependencyContainer {
    const scopedAdapter = new NestJSContainerAdapter(this.moduleRef);

    // Share by reference; the *Shared flags arm the write barriers on BOTH
    // sides. scopedInstances is intentionally NOT shared — fresh scoped
    // cache per scope (VF-030 D5).
    this.servicesShared = true;
    this.singletonInstancesShared = true;
    scopedAdapter.services = this.services;
    scopedAdapter.servicesShared = true;
    scopedAdapter.singletonInstances = this.singletonInstances;
    scopedAdapter.singletonInstancesShared = true;

    return scopedAdapter;
  }

  /**
   * Dispose of the container and clean up resources.
   *
   * Copy-on-write safe (VP-006b): the shared `services` /
   * `singletonInstances` maps are never `clear()`ed — this adapter merely
   * drops its references — so disposing a scope leaves the parent's maps
   * (and any sibling scope's snapshot) fully intact, and vice versa.
   */
  override dispose(): void {
    this.services = new Map();
    this.servicesShared = false;
    this.singletonInstances = new Map();
    this.singletonInstancesShared = false;
    this.scopedInstances.clear();
  }

  /**
   * Write barrier for the copy-on-write `services` map (VP-006b / OQ-2):
   * if the map may back another adapter's snapshot, replace it with a
   * private shallow copy before mutating. Descriptors themselves are never
   * mutated, so a shallow copy is sufficient.
   */
  private forkServicesIfShared(): void {
    if (this.servicesShared) {
      this.services = new Map(this.services);
      this.servicesShared = false;
    }
  }

  /**
   * Write barrier for the copy-on-write `singletonInstances` map
   * (VP-006b / OQ-2) — see {@link forkServicesIfShared}.
   */
  private forkSingletonInstancesIfShared(): void {
    if (this.singletonInstancesShared) {
      this.singletonInstances = new Map(this.singletonInstances);
      this.singletonInstancesShared = false;
    }
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
    // Get constructor parameters — lazy-once per constructor (VP-006b D-1):
    // the FIRST instantiation reads Reflect metadata, later ones hit the
    // module-level WeakMap (empty results are cached too).
    let paramTypes = paramTypesCache.get(constructor as Constructor<unknown>);
    if (paramTypes === undefined) {
      paramTypes =
        (Reflect.getMetadata('design:paramtypes', constructor) as
          | Constructor<unknown>[]
          | undefined) || [];
      paramTypesCache.set(constructor as Constructor<unknown>, paramTypes);
    }

    // Resolve dependencies — fail loudly on any unresolvable parameter
    const dependencies = paramTypes.map(paramType =>
      this.resolveDependency(paramType, constructor)
    );

    // Create instance with resolved dependencies
    return new constructor(...dependencies);
  }

  /**
   * Resolve a constructor dependency of `ownerToken` in a SINGLE pass
   * (VP-006b / OQ-3), overriding the base `isRegistered()` + `resolve()`
   * double lookup.
   *
   * Semantics are identical to the base implementation: an unregistered
   * dependency throws `ContainerServiceNotFoundError` with the owning
   * service as context (display string via the inherited `getTokenKey`),
   * and a resolution cycle throws `CircularDependencyError` with the full
   * chain. `CircularDependencyError` (and any other error from nested
   * resolution, e.g. `InvalidRegistrationError` or an owner-scoped
   * not-found from a deeper level) is NEVER swallowed or re-wrapped —
   * only THIS level's miss gets THIS owner's context.
   *
   * @throws ContainerServiceNotFoundError when the dependency is not registered
   * @throws CircularDependencyError when a resolution cycle is detected
   */
  protected override resolveDependency<T>(param: ServiceToken<T>, ownerToken: ServiceToken): T {
    if (this.resolutionChain.includes(param)) {
      throw new CircularDependencyError([...this.resolutionChain, param]);
    }

    this.resolutionChain.push(param);
    try {
      const result = this.resolveOrMiss(param);
      if (result === NOT_RESOLVED) {
        throw new ContainerServiceNotFoundError(param, this.getTokenKey(ownerToken));
      }
      return result;
    } finally {
      this.resolutionChain.pop();
    }
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
