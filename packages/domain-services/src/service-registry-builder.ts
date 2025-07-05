import type { IEventBus } from '@vytches-ddd/contracts';
import type { IUnitOfWork } from '@vytches-ddd/core';
import { DefaultDomainServiceRegistry } from './domain-service-registry';
import type { IDomainServiceRegistry } from './domain-service-registry.interface';
import type { IDomainService } from './domain-service.interface';
import { ServiceBuilder } from './service-builder';

/**
 * Builder for creating and configuring a service registry.
 * Provides a fluent API for service registration and configuration.
 *
 * @class ServiceRegistryBuilder
 */
export class ServiceRegistryBuilder {
  /**
   * The registry being configured.
   *
   * @private
   * @type {IDomainServiceRegistry}
   */
  private registry: IDomainServiceRegistry;

  /**
   * Optional event bus for services.
   *
   * @private
   * @type {IEventBus | undefined}
   */
  private eventBus?: IEventBus;

  /**
   * Optional Unit of Work for transactional services.
   *
   * @private
   * @type {IUnitOfWork | undefined}
   */
  private unitOfWork?: IUnitOfWork;

  /**
   * Creates a new registry builder.
   *
   * @param {IDomainServiceRegistry} [registry] - Optional existing registry to configure
   */
  constructor(registry?: IDomainServiceRegistry) {
    this.registry = registry || new DefaultDomainServiceRegistry();
  }

  /**
   * Sets the event bus for services created by this builder.
   *
   * @param {IEventBus} eventBus - Event bus instance
   * @returns {ServiceRegistryBuilder} This builder for method chaining
   */
  public withEventBus(eventBus: IEventBus): ServiceRegistryBuilder {
    this.eventBus = eventBus;
    return this;
  }

  /**
   * Sets the Unit of Work for services created by this builder.
   *
   * @param {IUnitOfWork} unitOfWork - Unit of Work instance
   * @returns {ServiceRegistryBuilder} This builder for method chaining
   */
  public withUnitOfWork(unitOfWork: IUnitOfWork): ServiceRegistryBuilder {
    this.unitOfWork = unitOfWork;
    return this;
  }

  /**
   * Creates a new builder for a service.
   *
   * @template T - Type extending IDomainService
   * @param {string} serviceId - Service identifier
   * @param {Function} factory - Factory function creating a service instance
   * @returns {ServiceBuilder<T>} Service builder
   * @example
   * const orderService = registryBuilder
   *   .service('orderService', (repo, validator) => new OrderService(repo, validator))
   *   .dependsOn('orderRepository')
   *   .dependsOn('orderValidator')
   *   .buildAndRegister();
   */
  public service<T extends IDomainService>(
    serviceId: string,
    factory: (...args: any[]) => T
  ): ServiceBuilder<T> {
    const builder = new ServiceBuilder<T>(this.registry, serviceId, factory);

    // Configure with event bus and Unit of Work if available
    if (this.eventBus) {
      builder.withEventBus(this.eventBus);
    }

    if (this.unitOfWork) {
      builder.withUnitOfWork(this.unitOfWork);
    }

    return builder;
  }

  /**
   * Directly registers a ready service instance.
   *
   * @template T - Type extending IDomainService
   * @param {T} service - Service instance to register
   * @param {string} [serviceId] - Optional service identifier
   * @returns {ServiceRegistryBuilder} This builder for method chaining
   * @example
   * registryBuilder
   *   .register(new OrderService())
   *   .register(new CustomerService(), 'customerManagement');
   */
  public register<T extends IDomainService>(
    service: T,
    serviceId?: string
  ): ServiceRegistryBuilder {
    this.registry.register(service, serviceId);
    return this;
  }

  /**
   * Returns the configured service registry.
   *
   * @returns {IDomainServiceRegistry} The configured service registry
   * @example
   * const registry = new ServiceRegistryBuilder()
   *   .register(orderService)
   *   .register(customerService)
   *   .build();
   *
   * application.setServiceRegistry(registry);
   */
  public build(): IDomainServiceRegistry {
    return this.registry;
  }
}
