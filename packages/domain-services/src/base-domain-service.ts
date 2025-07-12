import type {
  IDomainService,
  IEventBusAware,
  IUnitOfWorkAware,
  IAsyncDomainService,
} from './domain-service.interface';
import type { IDomainEvent, IEventBus } from '@vytches-ddd/contracts';
import type { IUnitOfWork } from '@vytches-ddd/core';

/**
 * Base implementation for domain services.
 *
 * Provides the core functionality required by all domain services.
 * This minimal implementation satisfies the IDomainService interface
 * and can be extended to create specialized domain services.
 *
 * @class IBaseDomainService
 * @implements {IDomainService}
 */
export abstract class IBaseDomainService implements IDomainService {
  /**
   * Creates a new instance of a domain service.
   *
   * @param {string} serviceId - Unique identifier for this service
   */
  constructor(public readonly serviceId: string) {}
}

/**
 * Base implementation for domain services that publish domain events.
 *
 * Extends the basic domain service with event publishing capabilities.
 * Services that need to emit domain events should extend this class.
 *
 * @class EventAwareDomainService
 * @extends {IBaseDomainService}
 * @implements {IEventBusAware}
 */
export abstract class EventAwareDomainService extends IBaseDomainService implements IEventBusAware {
  /**
   * Reference to the event bus for publishing domain events.
   *
   * @protected
   * @type {IEventBus | undefined}
   */
  protected eventBus?: IEventBus | undefined;

  /**
   * Creates a new event-aware domain service.
   *
   * @param {string} serviceId - Unique identifier for this service
   */
  constructor(serviceId: string) {
    super(serviceId);
  }

  /**
   * Sets the event bus instance for this service.
   * Must be called before any attempt to publish events.
   *
   * @param {IEventBus} eventBus - The event bus to use for publishing events
   */
  setEventBus(eventBus: IEventBus): void {
    this.eventBus = eventBus;
  }

  /**
   * Publishes a domain event to the registered event bus.
   *
   * @protected
   * @template T - Type extending IDomainEvent
   * @param {T} event - The domain event to publish
   * @throws {Error} If no event bus has been set
   */
  protected publishEvent<T extends IDomainEvent>(event: T): void {
    if (this.eventBus) {
      this.eventBus.publish(event);
    } else {
      throw new Error(`Event bus not set for service: ${this.serviceId}`);
    }
  }
}

/**
 * Base implementation for domain services that require transactional consistency.
 *
 * Extends the event-aware domain service with Unit of Work capabilities.
 * Services that need to coordinate operations across multiple aggregates
 * in a transactional manner should extend this class.
 *
 * @class UnitOfWorkAwareDomainService
 * @extends {EventAwareDomainService}
 * @implements {IUnitOfWorkAware}
 */
export abstract class UnitOfWorkAwareDomainService
  extends EventAwareDomainService
  implements IUnitOfWorkAware
{
  /**
   * Reference to the Unit of Work for transactional operations.
   *
   * @protected
   * @type {IUnitOfWork | undefined}
   */
  protected unitOfWork?: IUnitOfWork | undefined;

  /**
   * Creates a new Unit of Work aware domain service.
   *
   * @param {string} serviceId - Unique identifier for this service
   */
  constructor(serviceId: string) {
    super(serviceId);
  }

  /**
   * Sets the Unit of Work instance for this service.
   * Must be called before any transactional operation.
   *
   * @param {IUnitOfWork} unitOfWork - The Unit of Work to use
   */
  setUnitOfWork(unitOfWork: IUnitOfWork): void {
    this.unitOfWork = unitOfWork;
    // Automatically set event bus from Unit of Work
    this.eventBus = unitOfWork.getEventBus();
  }

  /**
   * Clears the Unit of Work reference.
   * Call this when the service should no longer use the current Unit of Work.
   */
  clearUnitOfWork(): void {
    this.unitOfWork = undefined;
    this.eventBus = undefined;
  }

  /**
   * Retrieves a repository from the current Unit of Work.
   *
   * @protected
   * @template T - The repository type
   * @param {string} name - The name of the repository to retrieve
   * @returns {T} The repository instance
   * @throws {Error} If no Unit of Work has been set
   */
  protected getRepository<T>(name: string): T {
    if (!this.unitOfWork) {
      throw new Error(`Unit of Work not set for service: ${this.serviceId}`);
    }
    return this.unitOfWork.getRepository(name) as T;
  }

  /**
   * Executes an operation within a transaction.
   * Automatically handles transaction begin, commit, and rollback.
   *
   * @protected
   * @template T - The return type of the operation
   * @param {() => Promise<T>} operation - The operation to execute in the transaction
   * @returns {Promise<T>} The result of the operation
   * @throws {Error} If no Unit of Work has been set
   * @throws {Error} If the operation fails (after rolling back the transaction)
   */
  protected async executeInTransaction<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.unitOfWork) {
      throw new Error(`Unit of Work not set for service: ${this.serviceId}`);
    }

    await this.unitOfWork.begin();

    try {
      const result = await operation();
      await this.unitOfWork.commit();
      return result;
    } catch (error) {
      await this.unitOfWork.rollback();
      throw error;
    }
  }
}

/**
 * Base implementation for domain services with asynchronous lifecycle management.
 *
 * Provides initialization and disposal capabilities for services that need
 * to manage resources or perform setup/teardown operations asynchronously.
 *
 * @class AsyncDomainService
 * @extends {IBaseDomainService}
 * @implements {IAsyncDomainService}
 */
export abstract class AsyncDomainService extends IBaseDomainService implements IAsyncDomainService {
  /**
   * Creates a new asynchronous domain service.
   *
   * @param {string} serviceId - Unique identifier for this service
   */
  constructor(serviceId: string) {
    super(serviceId);
  }

  /**
   * Initializes the service asynchronously.
   * Override this method to implement custom initialization logic.
   *
   * @returns {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    // Default implementation (empty)
  }

  /**
   * Disposes of the service asynchronously.
   * Override this method to implement custom disposal logic.
   *
   * @returns {Promise<void>} A promise that resolves when disposal is complete
   */
  async dispose(): Promise<void> {
    // Default implementation (empty)
  }
}
