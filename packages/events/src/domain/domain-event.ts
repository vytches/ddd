import type { IEventMetadata, IDomainEvent } from '@vytches/ddd-contracts';
import { LibUtils } from '@vytches/ddd-utils';

/**
 * Abstract base class for all domain events with common functionality.
 * Provides consistent event structure with auto-generated IDs and timestamps.
 *
 * @public
 * @stable
 * @since 0.22.0
 */
export abstract class DomainEvent<T = unknown> implements IDomainEvent<T> {
  /**
   * Unique identifier for the event
   */
  public readonly eventId: string;

  /**
   * When the event occurred
   */
  public readonly occurredOn: Date;

  /**
   * Name of the event, defaults to the class name
   */
  public readonly eventName: string;

  /**
   * Event payload
   */
  public readonly payload?: T | undefined;

  /**
   * Event metadata
   */
  public readonly metadata?: IEventMetadata;

  /**
   * Creates a new domain event
   *
   * @param payload - The event data
   * @param metadata - Optional metadata for the event
   * @param eventName - Optional custom event name (defaults to constructor.name)
   */
  constructor(payload?: T, metadata?: IEventMetadata, eventName?: string) {
    this.eventId = DomainEvent.generateId();
    this.occurredOn = new Date();
    this.eventName = eventName ?? this.constructor.name;
    this.payload = payload;

    this.metadata = {
      timestamp: this.occurredOn,
      ...(metadata || {}),
    };
  }

  /**
   * Generate a unique identifier for the event
   * This is a simple implementation that can be replaced in production
   */
  protected static generateId(): string {
    return LibUtils.getUUID();
  }

  /**
   * Create a copy of this event with additional metadata.
   *
   * This forks the event's identity: the copy is built by calling the
   * constructor, so it receives a **new** `eventId` and `occurredOn`. That is
   * the intended behaviour when the copy is meant to be a distinct event.
   *
   * Two cases it does not cover:
   * - Preserving identity — attaching metadata that infrastructure resolves
   *   late (a crypto-shredding key id, a correlation id assigned at dispatch)
   *   while keeping the event the same event. Use `enrichEvent()` from
   *   `@vytches/ddd-contracts`, or `AggregateRoot.transformDomainEvents()` when
   *   the events still live on an aggregate.
   * - Subclasses with their own constructor signature — this calls
   *   `new EventClass(payload, metadata, eventName)`, so an event declared as
   *   `constructor(orderId, total)` will not survive the round trip.
   *   `enrichEvent()` copies the prototype instead and never calls the
   *   constructor.
   *
   * @param metadata - Metadata to merge with existing metadata
   * @returns A new event instance with combined metadata and a fresh identity
   */
  public withMetadata(metadata: Partial<IEventMetadata>): DomainEvent<T> {
    const EventClass = this.constructor as new (
      payload?: T,
      metadata?: IEventMetadata,
      eventName?: string
    ) => DomainEvent<T>;

    return new EventClass(
      this.payload,
      {
        ...this.metadata,
        ...metadata,
      },
      this.eventName
    );
  }
}
