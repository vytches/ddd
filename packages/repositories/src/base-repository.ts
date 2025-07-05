import type {
  IEnhancedEventDispatcher,
  IEventPersistenceHandler,
  IAggregateWithEvents,
} from '@vytches-ddd/contracts';
import { IDomainError, DomainErrorCode } from '@vytches-ddd/domain-primitives';
import type { EntityId } from '@vytches-ddd/value-objects';

/**
 * Version error for repository operations
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
 * Base aggregate interface for repository operations
 */
export interface IRepositoryAggregate extends IAggregateWithEvents {
  getId(): EntityId;
  getInitialVersion(): number;
}

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
