// Note: IAggregateRoot is imported from core as peer dependency
// This creates a dependency on core, but repositories are typically used with aggregates

/**
 * @llm-summary Contract for repository functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * Repository interface implementing domain pattern implementation for repository operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteRepository implements IRepository {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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

/**
 * @llm-summary Contract for repository provider functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * RepositoryProvider interface implementing domain pattern implementation for repository provider operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteRepositoryProvider implements IRepositoryProvider {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IRepositoryProvider {
  getRepository<T>(name: string): T | undefined;
}

/**
 * @llm-summary Contract for extended repository functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * ExtendedRepository interface implementing domain pattern implementation for extended repository operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteExtendedRepository implements IExtendedRepository {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
