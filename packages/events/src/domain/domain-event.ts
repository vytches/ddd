/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IEventMetadata, IExtendedDomainEvent } from '@vytches-ddd/contracts';
import { LibUtils } from '@vytches-ddd/utils';

/**
 * Base implementation of a domain event
 * Provides core functionality for all domain events
 */
export abstract class DomainEvent<T = any> implements IExtendedDomainEvent<T> {
  /**
   * Unique identifier for the event
   */
  public readonly eventId: string;

  /**
   * When the event occurred
   */
  public readonly occurredOn: Date;

  /**
   * Type of the event, defaults to the class name
   */
  public readonly eventType: string;

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
   */
  constructor(payload?: T, metadata?: IEventMetadata) {
    this.eventId = DomainEvent.generateId();
    this.occurredOn = new Date();
    this.eventType = this.constructor.name;
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
      metadata?: IEventMetadata
    ) => DomainEvent<T>;

    return new EventClass(this.payload, {
      ...this.metadata,
      ...metadata,
    });
  }
}
