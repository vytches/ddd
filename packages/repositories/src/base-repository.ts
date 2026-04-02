import type {
  EntityId,
  IAggregateWithEvents,
  IEnhancedEventDispatcher,
  IEventPersistenceHandler,
} from '@vytches/ddd-contracts';
import { DomainErrorCode, IDomainError } from '@vytches/ddd-domain-primitives';
import { Logger } from '@vytches/ddd-logging';
import { Result } from '@vytches/ddd-utils';

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
  protected readonly logger = Logger.forContext(this.constructor.name);

  constructor(
    protected readonly eventDispatcher: IEnhancedEventDispatcher,
    protected readonly eventPersistenceHandler: IEventPersistenceHandler
  ) {}

  /**
   * Saves an aggregate by persisting its domain events
   * @param aggregate The aggregate to save
   * @throws VersionError if version conflict occurs
   */
  async save(aggregate: IRepositoryAggregate): Promise<void> {
    const aggregateId = aggregate.getId().getValue() as string | number;
    const events = aggregate.getDomainEvents();

    if (events.length === 0) {
      this.logger.debug('No events to persist', { aggregateId });
      return;
    }

    this.logger.debug('Saving aggregate', {
      aggregateId,
      eventCount: events.length,
      initialVersion: aggregate.getInitialVersion(),
    });

    const currentVersion =
      (await this.eventPersistenceHandler.getCurrentVersion(aggregate.getId())) ?? 0;
    const initialVersion = aggregate.getInitialVersion();

    if (initialVersion !== currentVersion) {
      this.logger.warn('Version conflict detected', {
        aggregateId,
        expectedVersion: currentVersion,
        actualVersion: initialVersion,
      });
      throw VersionError.withEntityIdAndVersions(aggregateId, currentVersion, initialVersion);
    }

    for (const event of events) {
      await this.eventPersistenceHandler.handleEvent(event);
    }

    // Publish events
    await this.eventDispatcher.dispatchEventsForAggregate(aggregate);

    this.logger.info('Aggregate saved successfully', {
      aggregateId,
      eventCount: events.length,
      newVersion: initialVersion + events.length,
    });
  }

  /**
   * Save aggregate, returning Result instead of throwing on version conflict.
   * @public
   * @stable
   * @since 0.24.0
   */
  async trySave(aggregate: IRepositoryAggregate): Promise<Result<void, VersionError>> {
    return Result.tryAsync(async () => {
      await this.save(aggregate);
    }) as Promise<Result<void, VersionError>>;
  }

  /**
   * Finds an aggregate by its identifier
   * @param id The entity identifier
   * @returns The aggregate or null if not found
   */
  abstract findById(id: unknown): Promise<unknown | null>;
}
