import type { IEventBus } from '@vytches/ddd-contracts';
import type { IRepository } from './base-repository.interface';

export interface IUnitOfWork {
  /**
   * Begins a new transaction.
   * This should be called before performing any operations that need to be
   * part of the same transaction.
   *
   * @returns {Promise<void>} A promise that resolves when the transaction has started
   * @throws {Error} If a transaction is already in progress or cannot be started
   * @memberof IUnitOfWork
   */
  begin(): Promise<void>;

  /**
   * Commits the current transaction and publishes collected domain events.
   * This persists all changes made within the transaction and makes them visible
   * to other transactions. After commit, all registered domain events are published.
   *
   * @returns {Promise<void>} A promise that resolves when the transaction is committed successfully
   * @throws {Error} If no transaction is in progress or the commit fails
   * @memberof IUnitOfWork
   */
  commit(): Promise<void>;

  /**
   * Rolls back the current transaction, discarding all changes.
   * This should be called when an error occurs during the transaction
   * to ensure data consistency.
   *
   * @returns {Promise<void>} A promise that resolves when the transaction is rolled back
   * @throws {Error} If no transaction is in progress or the rollback fails
   * @memberof IUnitOfWork
   */
  rollback(): Promise<void>;

  /**
   * Retrieves a repository registered with this Unit of Work.
   * Repositories obtained through this method will participate in the current transaction.
   *
   * @template T Repository type that extends IRepository
   * @param {string} name The name of the repository to retrieve
   * @returns {T} The repository instance
   * @throws {Error} If the repository with the specified name is not registered
   * @memberof IUnitOfWork
   */
  getRepository<T extends IRepository<{ getId(): unknown }>>(name: string): T;

  /**
   * Registers a repository with this Unit of Work.
   * Registered repositories will participate in the transaction managed by this Unit of Work.
   *
   * @template T Repository type that extends IRepository
   * @param {string} name The name to register the repository under
   * @param {T} repository The repository instance to register
   * @memberof IUnitOfWork
   */
  registerRepository<T extends IRepository<{ getId(): unknown }>>(
    name: string,
    repository: T
  ): void;

  /**
   * Gets the domain event bus associated with this Unit of Work.
   * Events published through this bus during a transaction will only be dispatched
   * after the transaction is successfully committed.
   *
   * @returns {IEventBus} The event bus instance
   * @memberof IUnitOfWork
   */
  getEventBus(): IEventBus;
}
