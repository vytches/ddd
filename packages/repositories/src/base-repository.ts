import type {
  EntityId,
  IAggregateWithEvents,
  IEnhancedEventDispatcher,
  IEventPersistenceHandler,
} from '@vytches/ddd-contracts';
import { DomainErrorCode, IDomainError } from '@vytches/ddd-domain-primitives';
import type { Result } from '@vytches/ddd-utils';

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

export interface IRepositoryAggregate extends IAggregateWithEvents {
  getId(): EntityId;
  getInitialVersion(): number;
}

export abstract class IBaseRepository {
  constructor(
    protected readonly eventDispatcher: IEnhancedEventDispatcher,
    protected readonly eventPersistenceHandler: IEventPersistenceHandler
  ) {}

  /**
   * Saves an aggregate by persisting its domain events
   * @param aggregate The aggregate to save
   * @throws VersionError if version conflict occurs
   */
  async save(
    aggregate: IRepositoryAggregate
  ): Promise<void | Result<void, VersionError | any> | any> {
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

    for (const event of events) {
      await this.eventPersistenceHandler.handleEvent(event);
    }

    // Publish events
    await this.eventDispatcher.dispatchEventsForAggregate(aggregate);
  }

  /**
   * Finds an aggregate by its identifier
   * @param id The entity identifier
   * @returns The aggregate or null if not found
   */
  abstract findById(id: unknown): Promise<unknown | null>;
}
