import { Capability } from '@vytches-ddd/contracts';
import type { IEventSourcingCapability, IEventStore } from '@vytches-ddd/contracts';
import { AggregateError } from '../aggregate-errors';
import type { IAggregateRoot } from '../aggregate-interfaces';

/**
 * @llm-summary EventSourcingCapability class for event sourcing capability operations
 * @llm-domain Pattern
 * @llm-complexity Medium
 *
 * @description
 * EventSourcingCapability class implementing domain pattern implementation for event sourcing capability operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new EventSourcingCapability();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new EventSourcingCapability());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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

  attach(aggregate: unknown): void {
    this.aggregate = aggregate as IAggregateRoot;
  }

  detach?(): void {
    this.aggregate = undefined!;
    this.eventStore = null;
  }

  setEventStore(eventStore: IEventStore): void {
    this.eventStore = eventStore;
  }

  getEventStore(): IEventStore | null {
    return this.eventStore;
  }

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
   * Check if event store is configured
   */
  hasEventStore(): boolean {
    return this.eventStore !== null;
  }

  /**
   * Get aggregate stream name for event store
   */
  getStreamName(): string {
    return `${this.aggregate.constructor.name}-${this.aggregate.getId().getValue()}`;
  }

  /**
   * Load events from a specific version
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
