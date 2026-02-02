export enum ServiceLifetime {
  /** New instance created for each resolution */
  Transient = 'transient',
  /** Single instance shared across all resolutions */
  Singleton = 'singleton',
  /** Instance scoped to a specific context or request */
  Scoped = 'scoped',
}

export type ServiceToken<T = unknown> = string | symbol | Constructor<T>;

export type Constructor<T = unknown> = new (...args: unknown[]) => T;

export type ServiceFactory<T = unknown> = (container: IDependencyContainer) => T;

export interface ServiceRegistrationOptions {
  /** Service lifetime management */
  lifetime?: ServiceLifetime | undefined;
  /** Optional context for scoped services */
  context?: string | undefined;
  /** Optional tags for service organization */
  tags?: string[] | undefined;
}

export interface ServiceDescriptor<T = unknown> {
  token: ServiceToken<T>;
  implementation?: Constructor<T>;
  factory?: ServiceFactory<T>;
  instance?: T;
  lifetime: ServiceLifetime;
  context?: string | undefined;
  tags?: string[] | undefined;
}

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
