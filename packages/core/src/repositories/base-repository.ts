import type { AggregateRoot } from '../aggregates';
import { VersionError } from '../aggregates';
import type { IEnhancedEventDispatcher, IEventPersistenceHandler } from '@vytches-ddd/contracts';

export abstract class IBaseRepository {
  constructor(
    protected readonly eventDispatcher: IEnhancedEventDispatcher,
    protected readonly eventPersistenceHandler: IEventPersistenceHandler
  ) {}

  async save(aggregate: AggregateRoot): Promise<void> {
    const events = aggregate.getDomainEvents();

    if (events.length === 0) return;

    const currentVersion =
      (await this.eventPersistenceHandler.getCurrentVersion(aggregate.getId())) ?? 0;
    const initialVersion = aggregate.getInitialVersion();

    if (initialVersion !== currentVersion) {
      throw VersionError.withEntityIdAndVersions(aggregate.getId(), currentVersion, initialVersion);
    }

    let version = currentVersion;

    for (const event of events) {
      version = await this.eventPersistenceHandler.handleEvent(event);
    }

    // Publish events
    await this.eventDispatcher.dispatchEventsForAggregate(aggregate);
  }

  abstract findById(id: any): Promise<any | null>;
}
