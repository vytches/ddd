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
   * Create a copy of this event with additional metadata
   *
   * @param metadata - Metadata to merge with existing metadata
   * @returns A new event instance with combined metadata
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
