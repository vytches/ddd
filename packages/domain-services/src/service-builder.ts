import type { IEventBus } from '@vytches-ddd/contracts';
import type { IUnitOfWork } from '@vytches-ddd/core';
import type { IDomainServiceRegistry } from './domain-service-registry.interface';
import type {
  IAsyncDomainService,
  IDomainService,
  IEventBusAware,
  IUnitOfWorkAware,
} from './domain-service.interface';

/**
 * Builder for creating and registering domain services
 * with a clear dependency chain. Supports type-safe dependency injection,
 * event bus integration, and Unit of Work integration.
 *
 * @class ServiceBuilder
 * @template T - Type of domain service being built
 * @template D - Tuple type representing dependencies (for type-safety)
 */
export class ServiceBuilder<T extends IDomainService, D extends unknown[] = []> {
  /**
   * Array of dependencies to inject into the service
   *
   * @private
   * @type {D}
   */
  private dependencies: D = [] as unknown as D;

  /**
   * Factory function that creates the service
   *
   * @private
   * @type {Function}
   */
  private factory: (...args: D) => T;

  /**
   * Service identifier
   *
   * @private
   * @type {string}
   */
  private id: string;

  /**
   * Optional event bus for event-aware services
   *
   * @private
   * @type {IEventBus | undefined}
   */
  private eventBus?: IEventBus;

  /**
   * Optional Unit of Work for transactional services
   *
   * @private
   * @type {IUnitOfWork | undefined}
   */
  private unitOfWork?: IUnitOfWork;

  /**
   * Whether to initialize the service asynchronously
   *
   * @private
   * @type {boolean}
   */
  private initializeAsync = false;

  /**
   * Service builder constructor
   *
   * @param {IDomainServiceRegistry} registry - Service registry where the service will be registered
   * @param {string} serviceId - Service identifier
   * @param {Function} factory - Function creating a service instance
   */
  constructor(
    private registry: IDomainServiceRegistry,
    serviceId: string,
    factory: (...args: D) => T
  ) {
    this.id = serviceId;
    this.factory = factory;
  }

  /**
   * Adds a dependency on another service
   *
   * @param {string} serviceId - Identifier of the service to depend on
   * @returns {ServiceBuilder<T, [...D, IDomainService]>} Builder for method chaining
   * @throws {Error} If dependency service is not found in registry
   */
  public dependsOn(serviceId: string): ServiceBuilder<T, [...D, IDomainService]> {
    const dependency = this.registry.get(serviceId);

    if (!dependency) {
      throw new Error(`Dependency service with ID '${serviceId}' not found in registry`);
    }

    return this.withDependency(dependency);
  }

  /**
   * Adds a direct dependency instance
   *
   * @template TDep - Type of dependency
   * @param {TDep} dependency - Dependency instance
   * @returns {ServiceBuilder<T, [...D, TDep]>} Builder with updated dependency types
   */
  public withDependency<TDep>(dependency: TDep): ServiceBuilder<T, [...D, TDep]> {
    // Create a new dependencies array with the added dependency
    const newDeps = [...this.dependencies, dependency] as unknown as [...D, TDep];

    // Create a new builder with the updated dependency type
    const newBuilder = new ServiceBuilder<T, [...D, TDep]>(
      this.registry,
      this.id,
      this.factory as unknown as (...args: [...D, TDep]) => T
    );

    // Transfer configuration - using type assertion to access private property
    (newBuilder as ServiceBuilder<T, [...D, TDep]> & Record<string, unknown>)['dependencies'] =
      newDeps;
    if (this.eventBus) newBuilder.withEventBus(this.eventBus);
    if (this.unitOfWork) newBuilder.withUnitOfWork(this.unitOfWork);
    if (this.initializeAsync) newBuilder.withAsyncInitialization();

    return newBuilder;
  }

  /**
   * Configures the service with an event bus
   *
   * @param {IEventBus} eventBus - Event bus to inject
   * @returns {ServiceBuilder<T, D>} Builder for method chaining
   */
  public withEventBus(eventBus: IEventBus): ServiceBuilder<T, D> {
    this.eventBus = eventBus;
    return this;
  }

  /**
   * Configures the service with a Unit of Work
   *
   * @param {IUnitOfWork} unitOfWork - Unit of Work to inject
   * @returns {ServiceBuilder<T, D>} Builder for method chaining
   */
  public withUnitOfWork(unitOfWork: IUnitOfWork): ServiceBuilder<T, D> {
    this.unitOfWork = unitOfWork;
    return this;
  }

  /**
   * Marks the service for asynchronous initialization
   * Service must implement IAsyncDomainService
   *
   * @returns {ServiceBuilder<T, D>} Builder for method chaining
   */
  public withAsyncInitialization(): ServiceBuilder<T, D> {
    this.initializeAsync = true;
    return this;
  }

  /**
   * Creates a service instance with dependencies
   *
   * @returns {Promise<T>} Created service instance
   */
  public async build(): Promise<T> {
    // Create the service with dependencies
    const service = this.factory(...this.dependencies);

    // Configure with event bus if applicable
    if (this.eventBus && this.isEventBusAware(service)) {
      service.setEventBus(this.eventBus);
    }

    // Configure with Unit of Work if applicable
    if (this.unitOfWork && this.isUnitOfWorkAware(service)) {
      service.setUnitOfWork(this.unitOfWork);
    }

    // Initialize asynchronously if applicable
    if (this.initializeAsync && this.isAsyncService(service)) {
      await service.initialize?.();
    }

    return service;
  }

  /**
   * Creates a service instance and registers it in the registry
   *
   * @returns {Promise<T>} Created and registered service instance
   */
  public async buildAndRegister(): Promise<T> {
    const service = await this.build();
    this.registry.register(service, this.id);
    return service;
  }

  /**
   * Creates a service instance synchronously
   * This maintains backward compatibility with existing code
   * Note: This does not perform async initialization
   *
   * @returns {T} Created service instance
   * @deprecated Use build() instead for full functionality
   */
  public buildSync(): T {
    const service = this.factory(...this.dependencies);

    // Configure with event bus if applicable
    if (this.eventBus && this.isEventBusAware(service)) {
      service.setEventBus(this.eventBus);
    }

    // Configure with Unit of Work if applicable
    if (this.unitOfWork && this.isUnitOfWorkAware(service)) {
      service.setUnitOfWork(this.unitOfWork);
    }

    return service;
  }

  /**
   * Checks if a service implements the IEventBusAware interface
   *
   * @private
   * @param {unknown} service - Service to check
   * @returns {boolean} True if service is event bus aware
   */
  private isEventBusAware(service: unknown): service is IEventBusAware {
    return (
      service !== null &&
      typeof service === 'object' &&
      'setEventBus' in service &&
      typeof (service as { setEventBus?: unknown }).setEventBus === 'function'
    );
  }

  /**
   * Checks if a service implements the IUnitOfWorkAware interface
   *
   * @private
   * @param {unknown} service - Service to check
   * @returns {boolean} True if service is Unit of Work aware
   */
  private isUnitOfWorkAware(service: unknown): service is IUnitOfWorkAware {
    return (
      service !== null &&
      typeof service === 'object' &&
      'setUnitOfWork' in service &&
      typeof (service as { setUnitOfWork?: unknown }).setUnitOfWork === 'function'
    );
  }

  /**
   * Checks if a service implements the IAsyncDomainService interface
   *
   * @private
   * @param {unknown} service - Service to check
   * @returns {boolean} True if service is async-capable
   */
  private isAsyncService(service: unknown): service is IAsyncDomainService {
    return (
      service !== null &&
      typeof service === 'object' &&
      'initialize' in service &&
      typeof (service as { initialize?: unknown }).initialize === 'function'
    );
  }
}
