import { Capability } from '@vytches/ddd-contracts';
import type { IEventSourcingCapability, IEventStore } from '@vytches/ddd-contracts';
import { AggregateError } from '../aggregate-errors';
import type { IAggregateRoot } from '../aggregate-interfaces';

/**
 * @description-inject
 * @business-context-inject
 * @example-inject
 */
export class EventSourcingCapability
  extends Capability<'eventSourcing'>
  implements IEventSourcingCapability
{
  override readonly type = 'eventSourcing' as const;

  static override get capabilityType(): string {
    return 'eventSourcing';
  }
  private aggregate!: IAggregateRoot;
  private eventStore: IEventStore | null = null;

  /**
   * @description-inject
   * @business-context-inject
   * @param {unknown} aggregate - Aggregate to attach this capability to
   * @example-inject
   */
  attach(aggregate: unknown): void {
    this.aggregate = aggregate as IAggregateRoot;
  }

  /**
   * @description-inject
   * @business-context-inject
   * @example-inject
   */
  detach?(): void {
    this.aggregate = undefined!;
    this.eventStore = null;
  }

  /**
   * @description-inject
   * @business-context-inject
   * @param {IEventStore} eventStore - Event store instance to use for persistence
   * @example-inject
   */
  setEventStore(eventStore: IEventStore): void {
    this.eventStore = eventStore;
  }

  /**
   * @description-inject
   * @business-context-inject
   * @returns {IEventStore | null} Currently configured event store or null
   * @example-inject
   */
  getEventStore(): IEventStore | null {
    return this.eventStore;
  }

  /**
   * @description-inject
   * @business-context-inject
   * @param {string | number} aggregateId - ID of aggregate to load events for
   * @throws {AggregateError} When event store is not configured
   * @example-inject
   */
  async loadFromEventStore(aggregateId: string | number): Promise<void> {
    if (!this.eventStore) {
      throw AggregateError.configurationError(
        this.aggregate.constructor.name,
        'Event store not configured'
      );
    }

    const events = await this.eventStore.getEvents(aggregateId);

    if (events.length === 0) {
      return;
    }

    // Load events into aggregate using internal method
    const aggregateWithLoader = this.aggregate as IAggregateRoot & {
      loadFromHistory?: (events: unknown[]) => void;
    };

    if (aggregateWithLoader.loadFromHistory) {
      aggregateWithLoader.loadFromHistory(events);
    }
  }

  /**
   * @description-inject
   * @business-context-inject
   * @throws {AggregateError} When event store is not configured
   * @example-inject
   */
  async saveToEventStore(): Promise<void> {
    if (!this.eventStore) {
      throw AggregateError.configurationError(
        this.aggregate.constructor.name,
        'Event store not configured'
      );
    }

    const events = this.aggregate.getDomainEvents();
    if (events.length === 0) {
      return;
    }

    await this.eventStore.saveEvents(
      this.aggregate.getId().getValue(),
      [...events],
      this.aggregate.getInitialVersion()
    );
  }

  /**
   * @description-inject
   * @business-context-inject
   * @returns {boolean} True if event store is configured
   * @example-inject
   */
  hasEventStore(): boolean {
    return this.eventStore !== null;
  }

  /**
   * @description-inject
   * @business-context-inject
   * @returns {string} Stream name combining aggregate type and ID
   * @example-inject
   */
  getStreamName(): string {
    return `${this.aggregate.constructor.name}-${this.aggregate.getId().getValue()}`;
  }

  /**
   * @description-inject
   * @business-context-inject
   * @param {string | number} aggregateId - ID of aggregate to load events for
   * @param {number} fromVersion - Version number to start loading from
   * @throws {AggregateError} When event store is not configured
   * @example-inject
   */
  async loadFromVersion(aggregateId: string | number, fromVersion: number): Promise<void> {
    if (!this.eventStore) {
      throw AggregateError.configurationError(
        this.aggregate.constructor.name,
        'Event store not configured'
      );
    }

    const events = await this.eventStore.getEventsAfterVersion(aggregateId, fromVersion);

    const aggregateWithLoader = this.aggregate as IAggregateRoot & {
      loadFromHistory?: (events: unknown[]) => void;
    };

    if (aggregateWithLoader.loadFromHistory && events.length > 0) {
      aggregateWithLoader.loadFromHistory(events);
    }
  }
}
