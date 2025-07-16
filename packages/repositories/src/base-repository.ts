import type {
  IEnhancedEventDispatcher,
  IEventPersistenceHandler,
  IAggregateWithEvents,
  EntityId,
} from '@vytches-ddd/contracts';
import { IDomainError, DomainErrorCode } from '@vytches-ddd/domain-primitives';

/**
 * @llm-summary VersionError class for version error operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * VersionError class implementing domain pattern implementation for version error operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new VersionError();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new VersionError());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class VersionError extends IDomainError {
  static withEntityIdAndVersions(
    id: string | number,
    dbVersion: number,
    newVersion: number
  ): VersionError {
    const message = `Version mismatch for entity with id ${id}: expected [${dbVersion}], got [${newVersion}]`;
    const options = {
      code: DomainErrorCode.ValidationFailed,
      data: { id, dbVersion, newVersion },
    };
    return new VersionError(message, options);
  }
}

/**
 * @llm-summary Contract for repository aggregate functionality
 * @llm-domain Pattern
 * @llm-contract Required
 *
 * @description
 * RepositoryAggregate interface implementing domain pattern implementation for repository aggregate operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteRepositoryAggregate implements IRepositoryAggregate {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IRepositoryAggregate extends IAggregateWithEvents {
  getId(): EntityId;
  getInitialVersion(): number;
}

/**
 * @llm-summary BaseRepository class for base repository operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * BaseRepository class implementing domain pattern implementation for base repository operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new IBaseRepository();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new IBaseRepository());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class IBaseRepository {
  constructor(
    protected readonly eventDispatcher: IEnhancedEventDispatcher,
    protected readonly eventPersistenceHandler: IEventPersistenceHandler
  ) {}

  async save(aggregate: IRepositoryAggregate): Promise<void> {
    const events = aggregate.getDomainEvents();

    if (events.length === 0) return;

    const currentVersion =
      (await this.eventPersistenceHandler.getCurrentVersion(aggregate.getId())) ?? 0;
    const initialVersion = aggregate.getInitialVersion();

    if (initialVersion !== currentVersion) {
      throw VersionError.withEntityIdAndVersions(
        aggregate.getId().getValue() as string | number,
        currentVersion,
        initialVersion
      );
    }

    let version = currentVersion;

    for (const event of events) {
      version = await this.eventPersistenceHandler.handleEvent(event);
    }

    // Publish events
    await this.eventDispatcher.dispatchEventsForAggregate(aggregate);
  }

  abstract findById(id: unknown): Promise<unknown | null>;
}
