/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  IAggregateRoot,
  IEventSourcingCapability,
} from '../aggregate-interfaces';
import type { IExtendedDomainEvent, IEventStore } from '@vytches-ddd/contracts';

import { AggregateError } from '../aggregate-errors';

/**
 * Event sourcing capability implementation
 * Handles loading and saving aggregates from/to event stores
 */
export class EventSourcingCapability implements IEventSourcingCapability {
  private aggregate!: IAggregateRoot<any>;
  private _eventStore?: IEventStore | undefined;

  constructor(eventStore?: IEventStore) {
    this._eventStore = eventStore;
  }

  attach(aggregate: IAggregateRoot<any>): void {
    this.aggregate = aggregate;
  }

  detach?(): void {
    this.aggregate = null as any;
  }

  async loadFromEventStore(aggregateId: any): Promise<void> {
    if (!this._eventStore) {
      throw AggregateError.eventStoreNotConfigured();
    }

    const events = await this._eventStore.getEvents(aggregateId);
    if (events.length > 0) {
      this.replayEvents(events);
    }
  }

  async saveToEventStore(): Promise<void> {
    if (!this._eventStore) {
      throw AggregateError.eventStoreNotConfigured();
    }

    const events = this.aggregate.getDomainEvents();
    if (events.length === 0) return;

    await this._eventStore.saveEvents(
      this.aggregate.getId().getValue(),
      [...events],
      this.aggregate.getVersion(),
    );

    this.aggregate.commit();
  }

  replayEvents(events: IExtendedDomainEvent[]): void {
    // Use the protected method if available
    if (typeof (this.aggregate as any).loadFromHistory === 'function') {
      (this.aggregate as any).loadFromHistory(events);
    } else {
      throw AggregateError.aggregateDoesNotSupportReplay(
        this.aggregate.constructor.name,
      );
    }
  }

  /**
   * Sets or updates the event store
   */
  setEventStore(eventStore: IEventStore): void {
    this._eventStore = eventStore;
  }

  /**
   * Gets the current event store
   */
  getEventStore(): IEventStore | undefined {
    return this._eventStore;
  }

  /**
   * Checks if event store is configured
   */
  hasEventStore(): boolean {
    return this._eventStore !== undefined;
  }

  /**
   * Loads events from a specific version onwards
   */
  async loadEventsFromVersion(
    aggregateId: any,
    fromVersion: number,
  ): Promise<IExtendedDomainEvent[]> {
    if (!this._eventStore) {
      throw AggregateError.eventStoreNotConfigured();
    }

    return await this._eventStore.getEventsAfterVersion(
      aggregateId,
      fromVersion,
    );
  }

  /**
   * Rebuilds aggregate from a specific point in time
   */
  async rebuildFromVersion(
    aggregateId: any,
    fromVersion: number,
  ): Promise<void> {
    const events = await this.loadEventsFromVersion(aggregateId, fromVersion);
    this.replayEvents(events);
  }
}
