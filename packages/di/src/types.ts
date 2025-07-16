/**
 * @llm-summary Enumeration of service lifetime values
 * @llm-domain Infrastructure
 * @llm-usage Frequent
 *
 * @description
 * ServiceLifetime enum implementing infrastructure service for service lifetime operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: ServiceLifetime = ServiceLifetime.VALUE;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export enum ServiceLifetime {
  /** New instance created for each resolution */
  Transient = 'transient',
  /** Single instance shared across all resolutions */
  Singleton = 'singleton',
  /** Instance scoped to a specific context or request */
  Scoped = 'scoped',
}

/**
 * @llm-summary Type definition for service token
 * @llm-domain Infrastructure
 * @llm-usage Frequent
 *
 * @description
 * ServiceToken type implementing infrastructure service for service token operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: ServiceToken = {} as ServiceToken;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type ServiceToken<T = any> = string | symbol | Constructor<T>;

/**
 * @llm-summary Type definition for constructor
 * @llm-domain Infrastructure
 * @llm-usage Frequent
 *
 * @description
 * Constructor type implementing infrastructure service for constructor operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: Constructor = {} as Constructor;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type Constructor<T = any> = new (...args: any[]) => T;

/**
 * @llm-summary Type definition for service factory
 * @llm-domain Infrastructure
 * @llm-usage Frequent
 *
 * @description
 * ServiceFactory type implementing infrastructure service for service factory operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: ServiceFactory = {} as ServiceFactory;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export type ServiceFactory<T = any> = (container: IDependencyContainer) => T;

/**
 * @llm-summary Contract for service registration options functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ServiceRegistrationOptions interface implementing infrastructure service for service registration options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteServiceRegistrationOptions implements ServiceRegistrationOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ServiceRegistrationOptions {
  /** Service lifetime management */
  lifetime?: ServiceLifetime | undefined;
  /** Optional context for scoped services */
  context?: string | undefined;
  /** Optional tags for service organization */
  tags?: string[] | undefined;
}

/**
 * @llm-summary Contract for service descriptor functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ServiceDescriptor interface implementing infrastructure service for service descriptor operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteServiceDescriptor implements ServiceDescriptor {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ServiceDescriptor<T = any> {
  token: ServiceToken<T>;
  implementation?: Constructor<T>;
  factory?: ServiceFactory<T>;
  instance?: T;
  lifetime: ServiceLifetime;
  context?: string | undefined;
  tags?: string[] | undefined;
}

/**
 * @llm-summary Contract for dependency container functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * DependencyContainer interface implementing infrastructure service for dependency container operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteDependencyContainer implements IDependencyContainer {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IDependencyContainer {
  /**
   * Resolve a service by token
   * @param token - Service token to resolve
   * @returns Resolved service instance
   */
  resolve<T>(token: ServiceToken<T>): T;

  /**
   * Register a service with the container
   * @param token - Service token
   * @param implementation - Service implementation constructor
   * @param options - Registration options
   */
  register<T>(
    token: ServiceToken<T>,
    implementation: Constructor<T>,
    options?: ServiceRegistrationOptions
  ): void;

  /**
   * Register a service using a factory function
   * @param token - Service token
   * @param factory - Factory function to create service instances
   * @param options - Registration options
   */
  registerFactory<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    options?: ServiceRegistrationOptions
  ): void;

  /**
   * Register a service instance
   * @param token - Service token
   * @param instance - Service instance
   * @param options - Registration options
   */
  registerInstance<T>(
    token: ServiceToken<T>,
    instance: T,
    options?: ServiceRegistrationOptions
  ): void;

  /**
   * Check if a service is registered
   * @param token - Service token to check
   * @returns True if service is registered
   */
  isRegistered<T>(token: ServiceToken<T>): boolean;

  /**
   * Get all registered services
   * @returns Array of service descriptors
   */
  getServices(): ServiceDescriptor[];

  /**
   * Get services by tag
   * @param tag - Tag to filter by
   * @returns Array of matching service descriptors
   */
  getServicesByTag(tag: string): ServiceDescriptor[];

  /**
   * Create a scoped container (optional for advanced containers)
   * @param context - Optional context name for the scope
   * @returns New scoped container instance
   */
  createScope?(context?: string): IDependencyContainer;

  /**
   * Dispose of the container and clean up resources
   */
  dispose?(): void;
}

/**
 * @llm-summary Contract for resolution context functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ResolutionContext interface implementing infrastructure service for resolution context operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteResolutionContext implements ResolutionContext {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ResolutionContext {
  /** Token being resolved */
  token: ServiceToken;
  /** Resolution chain for dependency tracking */
  resolutionChain: ServiceToken[];
  /** Context name if applicable */
  context?: string;
  /** Timestamp of resolution */
  timestamp: Date;
}

/**
 * @llm-summary Contract for container builder functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 *
 * @description
 * ContainerBuilder interface implementing infrastructure service for container builder operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteContainerBuilder implements IContainerBuilder {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IContainerBuilder {
  /**
   * Register a service
   * @param token - Service token
   * @param implementation - Service implementation
   * @param options - Registration options
   */
  register<T>(
    token: ServiceToken<T>,
    implementation: Constructor<T>,
    options?: ServiceRegistrationOptions
  ): IContainerBuilder;

  /**
   * Register a service factory
   * @param token - Service token
   * @param factory - Factory function
   * @param options - Registration options
   */
  registerFactory<T>(
    token: ServiceToken<T>,
    factory: ServiceFactory<T>,
    options?: ServiceRegistrationOptions
  ): IContainerBuilder;

  /**
   * Register a service instance
   * @param token - Service token
   * @param instance - Service instance
   * @param options - Registration options
   */
  registerInstance<T>(
    token: ServiceToken<T>,
    instance: T,
    options?: ServiceRegistrationOptions
  ): IContainerBuilder;

  /**
   * Build the container
   * @returns Configured container instance
   */
  build(): IDependencyContainer;
}
