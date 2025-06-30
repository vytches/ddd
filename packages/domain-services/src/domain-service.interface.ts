import type { IEventBus } from '@vytches-ddd/contracts';
import type { IUnitOfWork } from '@vytches-ddd/core';

/**
 * Base interface for domain services in DDD architecture.
 * Domain services encapsulate domain logic that doesn't naturally belong to entities or value objects.
 * They are stateless and operate on multiple aggregates or domain objects.
 *
 * @interface IDomainService
 */
export interface IDomainService {
  /**
   * Optional service identifier used for registration and lookup in service registry.
   * This ID should be unique within a bounded context.
   *
   * @type {string | undefined}
   * @memberof IDomainService
   */
  readonly serviceId?: string;
}

/**
 * Interface for domain services supporting asynchronous lifecycle operations.
 * Extends the base domain service interface with initialization and disposal capabilities.
 * Use this for services that need to acquire and release resources.
 *
 * @interface IAsyncDomainService
 * @extends {IDomainService}
 */
export interface IAsyncDomainService extends IDomainService {
  /**
   * Asynchronously initializes the service.
   * Called after the service is created but before it's used.
   * Use this method to set up resources, establish connections, or perform other startup tasks.
   *
   * @returns {Promise<void>} A promise that resolves when initialization is complete
   * @memberof IAsyncDomainService
   */
  initialize?(): Promise<void>;

  /**
   * Asynchronously disposes of the service.
   * Called when the service is no longer needed.
   * Use this method to clean up resources, close connections, or perform other shutdown tasks.
   *
   * @returns {Promise<void>} A promise that resolves when disposal is complete
   * @memberof IAsyncDomainService
   */
  dispose?(): Promise<void>;
}

/**
 * Interface for services that can work with a Unit of Work.
 * This enables domain services to participate in transactions and coordinate changes
 * across multiple aggregates in a consistent manner.
 *
 * @interface IUnitOfWorkAware
 */
export interface IUnitOfWorkAware {
  /**
   * Sets the Unit of Work context for transactional operations.
   * After this is called, the service will use the provided Unit of Work
   * for all operations that require transactional consistency.
   *
   * @param {IUnitOfWork} unitOfWork - The Unit of Work instance to use
   * @memberof IUnitOfWorkAware
   */
  setUnitOfWork(unitOfWork: IUnitOfWork): void;

  /**
   * Clears the current Unit of Work context.
   * Call this when the service should no longer use the previously set Unit of Work.
   *
   * @memberof IUnitOfWorkAware
   */
  clearUnitOfWork(): void;
}

/**
 * Interface for services that can work with a domain event bus.
 * This enables domain services to publish domain events without
 * direct coupling to a specific event bus implementation.
 *
 * @interface IEventBusAware
 */
export interface IEventBusAware {
  /**
   * Sets the event bus for the service to use when publishing events.
   * After this is called, the service can publish domain events through the provided bus.
   *
   * @param {IEventBus} eventBus - The event bus instance to use
   * @memberof IEventBusAware
   */
  setEventBus(eventBus: IEventBus): void;
}

/**
 * Interface for domain services that require transactional consistency.
 * Combines the domain service interface with the Unit of Work awareness interface.
 * Use this for services that need to coordinate changes across multiple aggregates
 * in a transactional manner.
 *
 * @interface ITransactionalDomainService
 * @extends {IDomainService}
 * @extends {IUnitOfWorkAware}
 */
export interface ITransactionalDomainService
  extends IDomainService,
    IUnitOfWorkAware {}
