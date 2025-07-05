// Note: IAggregateRoot is imported from core as peer dependency
// This creates a dependency on core, but repositories are typically used with aggregates

/**
 * Interface for basic repository operations
 * Provides a minimal contract for aggregate persistence
 */
export interface IRepository<T extends { getId(): unknown }> {
  /**
   * Find an aggregate by its identifier
   *
   * @param id - The aggregate identifier
   * @returns The aggregate if found, null otherwise
   */
  findById?(id: unknown): Promise<T | null>;

  /**
   * Save an aggregate
   * This will create or update the aggregate
   *
   * @param aggregate - The aggregate to save
   */
  save(aggregate: T): Promise<void>;

  /**
   * Delete an aggregate
   *
   * @param aggregate - The aggregate to delete
   */
  delete?(aggregate: T): Promise<void>;
}

export interface IRepositoryProvider {
  getRepository<T>(name: string): T | undefined;
}

/**
 * Extended repository interface with additional operations
 * Provides more advanced functionality while remaining optional
 */
export interface IExtendedRepository<T extends { getId(): unknown }> extends IRepository<T> {
  /**
   * Check if an aggregate exists
   *
   * @param id - The aggregate identifier
   * @returns True if the aggregate exists
   */
  exists(id: unknown): Promise<boolean>;

  /**
   * Find aggregates matching a given specification
   *
   * @param spec - The specification to match
   * @returns Matching aggregates
   */
  findBySpecification?(spec: unknown): Promise<T[]>;

  /**
   * Find a single aggregate matching a specification
   *
   * @param spec - The specification to match
   * @returns The matching aggregate or null
   */
  findOneBySpecification?(spec: unknown): Promise<T | null>;
}
