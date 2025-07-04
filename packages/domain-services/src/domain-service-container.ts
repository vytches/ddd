import type { IEventBus } from '@vytches-ddd/contracts';
import type { IUnitOfWork } from '@vytches-ddd/core';
import { DefaultDomainServiceRegistry } from './domain-service-registry';
import type { IDomainServiceRegistry } from './domain-service-registry.interface';
import type {
  IAsyncDomainService,
  IDomainService,
  IEventBusAware,
  IUnitOfWorkAware,
} from './domain-service.interface';
import { ServiceCircularError } from './service.errors';

/**
 * Container for domain services with dependency resolution capabilities.
 * Manages service lifecycle, resolves dependencies, and configures services
 * with infrastructure components like event bus and Unit of Work.
 *
 * @class DomainServiceContainer
 */
export class DomainServiceContainer {
  /**
   * Registry for storing and retrieving services.
   *
   * @private
   * @type {IDomainServiceRegistry}
   */
  private registry: IDomainServiceRegistry;

  /**
   * Map of factory functions for creating service instances.
   *
   * @private
   * @type {Map<string, () => IDomainService>}
   */
  private factories: Map<string, () => IDomainService> = new Map();

  /**
   * Map of service dependencies.
   *
   * @private
   * @type {Map<string, string[]>}
   */
  private dependencies: Map<string, string[]> = new Map();

  /**
   * Optional event bus for configuring event-aware services.
   *
   * @private
   * @type {IEventBus | undefined}
   */
  private eventBus?: IEventBus | undefined;

  /**
   * Optional Unit of Work provider function.
   *
   * @private
   * @type {(() => IUnitOfWork) | undefined}
   */
  private unitOfWorkProvider?: (() => IUnitOfWork) | undefined;

  /**
   * Creates a new domain service container.
   *
   * @param {IDomainServiceRegistry} [registry] - Optional custom registry (creates default if not provided)
   * @param {IEventBus} [eventBus] - Optional event bus for services
   * @param {(() => IUnitOfWork)} [unitOfWorkProvider] - Optional function that provides Unit of Work instances
   */
  constructor(
    registry?: IDomainServiceRegistry,
    eventBus?: IEventBus,
    unitOfWorkProvider?: () => IUnitOfWork,
  ) {
    this.registry = registry || new DefaultDomainServiceRegistry();
    this.eventBus = eventBus;
    this.unitOfWorkProvider = unitOfWorkProvider;
  }

  /**
   * Registers a service factory function.
   *
   * @param {string} serviceId - Service identifier
   * @param {() => IDomainService} factory - Function creating a service instance
   * @param {string[]} [dependencies=[]] - Array of service IDs this service depends on
   * @example
   * container.registerFactory(
   *   'orderService',
   *   () => new OrderProcessingService(),
   *   ['productRepository', 'customerService']
   * );
   */
  public registerFactory(
    serviceId: string,
    factory: () => IDomainService,
    dependencies: string[] = [],
  ): void {
    this.factories.set(serviceId, factory);
    this.dependencies.set(serviceId, dependencies);
  }

  /**
   * Sets the event bus for this container.
   * This event bus will be injected into all event-aware services.
   *
   * @param {IEventBus} eventBus - The event bus to use
   * @returns {DomainServiceContainer} This container for method chaining
   */
  public setEventBus(eventBus: IEventBus): DomainServiceContainer {
    this.eventBus = eventBus;
    return this;
  }

  /**
   * Sets the Unit of Work provider for this container.
   * This provider will be used to create Unit of Work instances for services.
   *
   * @param {() => IUnitOfWork} provider - Function that provides Unit of Work instances
   * @returns {DomainServiceContainer} This container for method chaining
   */
  public setUnitOfWorkProvider(
    provider: () => IUnitOfWork,
  ): DomainServiceContainer {
    this.unitOfWorkProvider = provider;
    return this;
  }

  /**
   * Initializes all registered services in the correct order, respecting dependencies.
   * Configures services with event bus and Unit of Work if applicable.
   *
   * @throws {Error} If a circular dependency is detected
   * @example
   * container.registerFactory('service1', () => new Service1());
   * container.registerFactory('service2', () => new Service2(), ['service1']);
   * container.initializeServices();
   */
  public initializeServices(): void {
    const initialized = new Set<string>();
    const pending = new Set<string>(this.factories.keys());

    // Keep trying to initialize services until we make no more progress
    while (pending.size > 0) {
      let progress = false;

      for (const serviceId of pending) {
        const deps = this.dependencies.get(serviceId) || [];
        const canInitialize = deps.every((dep) => initialized.has(dep));

        if (canInitialize) {
          // Create the service
          const factory = this.factories.get(serviceId)!;
          const service = factory();

          // Configure the service with event bus if applicable
          if (this.eventBus && this.isEventBusAware(service)) {
            service.setEventBus(this.eventBus);
          }

          // Configure the service with Unit of Work if applicable
          if (this.unitOfWorkProvider && this.isUnitOfWorkAware(service)) {
            service.setUnitOfWork(this.unitOfWorkProvider());
          }

          // Register the service
          this.registry.register(service, serviceId);

          initialized.add(serviceId);
          pending.delete(serviceId);
          progress = true;
        }
      }

      // If we made no progress but still have pending services, we have a circular dependency
      if (!progress && pending.size > 0) {
        const remaining = Array.from(pending);
        throw ServiceCircularError.withServices(remaining);
      }
    }

    // Initialize async services
    this.initializeAsyncServices();
  }

  /**
   * Initializes asynchronous services.
   * Should be called after all services are registered.
   *
   * @private
   * @async
   */
  private async initializeAsyncServices(): Promise<void> {
    const asyncServices: IAsyncDomainService[] = [];

    // Collect all async services
    for (const [_, service] of this.registry.getAll()) {
      if (this.isAsyncService(service)) {
        asyncServices.push(service);
      }
    }

    // Initialize them in parallel
    await Promise.all(asyncServices.map((service) => service.initialize?.()));
  }

  /**
   * Retrieves a service from the registry.
   *
   * @template T - Type extending IDomainService
   * @param {string} serviceId - Service identifier
   * @returns {T | undefined} The service instance or undefined if not found
   */
  public getService<T extends IDomainService>(
    serviceId: string,
  ): T | undefined {
    return this.registry.get<T>(serviceId);
  }

  /**
   * Returns the registry being used by this container.
   *
   * @returns {IDomainServiceRegistry} The service registry
   */
  public getRegistry(): IDomainServiceRegistry {
    return this.registry;
  }

  /**
   * Checks if a service implements the IEventBusAware interface.
   *
   * @private
   * @param {unknown} service - Service to check
   * @returns {boolean} True if the service implements IEventBusAware
   */
  private isEventBusAware(service: unknown): service is IEventBusAware {
    return (
      service !== null &&
      typeof service === 'object' &&
      'setEventBus' in service && typeof (service as { setEventBus?: unknown }).setEventBus === 'function'
    );
  }

  /**
   * Checks if a service implements the IUnitOfWorkAware interface.
   *
   * @private
   * @param {unknown} service - Service to check
   * @returns {boolean} True if the service implements IUnitOfWorkAware
   */
  private isUnitOfWorkAware(service: unknown): service is IUnitOfWorkAware {
    return (
      service !== null &&
      typeof service === 'object' &&
      'setUnitOfWork' in service && typeof (service as { setUnitOfWork?: unknown }).setUnitOfWork === 'function'
    );
  }

  /**
   * Checks if a service implements the IAsyncDomainService interface.
   *
   * @private
   * @param {unknown} service - Service to check
   * @returns {boolean} True if the service implements IAsyncDomainService
   */
  private isAsyncService(service: unknown): service is IAsyncDomainService {
    return (
      service !== null &&
      typeof service === 'object' &&
      'initialize' in service && typeof (service as { initialize?: unknown }).initialize === 'function'
    );
  }
}
