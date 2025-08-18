/**
 * Repository interfaces for the contracts package
 * These provide the base contracts for repository patterns without dependencies on higher-level packages
 */

import type { IEventBus } from '../events';

/**
 * Minimal entity interface required for repository operations
 */
export interface IRepositoryEntity {
  /**
   * Get the unique identifier of the entity
   */
  getId(): unknown;
}

/**
 * Base repository interface for persistence operations
 */
export interface IRepository<T extends IRepositoryEntity> {
  /**
   * Find an entity by its identifier
   * @param id The entity identifier
   * @returns The entity if found, null otherwise
   */
  findById?(id: unknown): Promise<T | null>;

  /**
   * Save an entity (create or update)
   * @param entity The entity to save
   * @returns Promise that resolves when save is complete
   */
  save(entity: T): Promise<void>;

  /**
   * Delete an entity
   * @param entity The entity to delete
   */
  delete?(entity: T): Promise<void>;
}

/**
 * Extended repository interface with additional query capabilities
 */
export interface IExtendedRepository<T extends IRepositoryEntity> extends IRepository<T> {
  /**
   * Check if an entity exists
   * @param id The entity identifier
   * @returns True if the entity exists
   */
  exists(id: unknown): Promise<boolean>;

  /**
   * Find entities matching a given specification
   * @param spec The specification to match
   * @returns Matching entities
   */
  findBySpecification?(spec: unknown): Promise<T[]>;

  /**
   * Find a single entity matching a specification
   * @param spec The specification to match
   * @returns The matching entity or null
   */
  findOneBySpecification?(spec: unknown): Promise<T | null>;
}

/**
 * Repository provider interface for repository registry/factory pattern
 */
export interface IRepositoryProvider {
  /**
   * Get a repository by name
   * @param name The repository name
   * @returns The repository instance if found
   */
  getRepository<T>(name: string): T | undefined;
}

/**
 * Unit of Work interface for transaction management
 */
export interface IUnitOfWork {
  /**
   * Begins a new transaction
   * @throws {Error} If a transaction is already in progress
   */
  begin(): Promise<void>;

  /**
   * Commits the current transaction and publishes collected domain events
   * @throws {Error} If no transaction is in progress or the commit fails
   */
  commit(): Promise<void>;

  /**
   * Rolls back the current transaction, discarding all changes
   * @throws {Error} If no transaction is in progress or the rollback fails
   */
  rollback(): Promise<void>;

  /**
   * Retrieves a repository registered with this Unit of Work
   * @param name The name of the repository to retrieve
   * @returns The repository instance
   * @throws {Error} If the repository with the specified name is not registered
   */
  getRepository<T extends IRepository<IRepositoryEntity>>(name: string): T;

  /**
   * Registers a repository with this Unit of Work
   * @param name The name to register the repository under
   * @param repository The repository instance to register
   */
  registerRepository<T extends IRepository<IRepositoryEntity>>(name: string, repository: T): void;

  /**
   * Gets the domain event bus associated with this Unit of Work
   * @returns The event bus instance
   */
  getEventBus(): IEventBus;
}

/**
 * Query repository interface for read operations
 */
export interface IQueryRepository<T extends IRepositoryEntity> {
  /**
   * Find all entities
   * @returns All entities
   */
  findAll(): Promise<T[]>;

  /**
   * Find entities with pagination
   * @param limit Maximum number of entities to return
   * @param offset Number of entities to skip
   * @returns Paginated entities
   */
  findWithPagination(limit: number, offset: number): Promise<T[]>;

  /**
   * Count total number of entities
   * @returns Total count
   */
  count(): Promise<number>;
}

/**
 * Write repository interface for write operations
 */
export interface IWriteRepository<T extends IRepositoryEntity> {
  /**
   * Create a new entity
   * @param entity The entity to create
   * @returns The created entity
   */
  create(entity: T): Promise<T>;

  /**
   * Update an existing entity
   * @param entity The entity to update
   * @returns The updated entity
   */
  update(entity: T): Promise<T>;

  /**
   * Delete an entity by id
   * @param id The entity identifier
   * @returns True if deleted, false if not found
   */
  deleteById(id: unknown): Promise<boolean>;
}

/**
 * Full CQRS repository combining read and write operations
 */
export interface ICQRSRepository<T extends IRepositoryEntity>
  extends IQueryRepository<T>,
    IWriteRepository<T> {}
