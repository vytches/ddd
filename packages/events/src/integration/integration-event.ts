/* eslint-disable @typescript-eslint/no-explicit-any */
import { LibUtils } from '@vytches/ddd-utils';

import type { IIntegrationEvent, IIntegrationEventMetadata } from './integration-event-interfaces';

/**
 * @llm-summary IntegrationEvent class for integration event operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * IntegrationEvent class implementing architectural component for integration event operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new IntegrationEvent();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export abstract class IntegrationEvent<T = unknown> implements IIntegrationEvent<T> {
  /**
   * Unique identifier for the event
   */
  public readonly eventId: string;

  /**
   * When the event was created
   */
  public readonly timestamp: Date;

  /**
   * Type of the event, defaults to the class name
   */
  public readonly eventType: string;

  /**
   * Payload of the event
   */
  public readonly payload?: T | undefined;

  /**
   * Metadata of the event
   */
  public readonly metadata?: IIntegrationEventMetadata;

  /**
   * Creates a new integration event
   *
   * @param payload - The event data
   * @param metadata - Optional metadata for the event
   */
  constructor(payload?: T, metadata?: IIntegrationEventMetadata) {
    this.eventId = IntegrationEvent.generateId();
    this.timestamp = new Date();
    this.eventType = this.constructor.name;
    this.payload = payload;

    this.metadata = {
      eventId: this.eventId,
      timestamp: this.timestamp,
      schemaVersion: 1, // Default schema version
      ...(metadata || {}),
    };
  }

  /**
   * Generates a unique identifier for the event
   * This is a simple implementation that can be replaced in production
   */
  protected static generateId(): string {
    return LibUtils.getUUID();
  }

  /**
   * Creates a copy of this event with additional metadata
   *
   * @param metadata - Metadata to merge with existing metadata
   * @returns A new event instance with combined metadata
   */
  public withMetadata(metadata: Partial<IIntegrationEventMetadata>): IntegrationEvent<T> {
    const EventClass = this.constructor as new (
      payload?: T,
      metadata?: IIntegrationEventMetadata
    ) => IntegrationEvent<T>;

    return new EventClass(this.payload, {
      ...this.metadata,
      ...metadata,
    });
  }

  /**
   * Serializes the event to JSON format
   * @returns Serialized event as JSON string
   */
  public serialize(): string {
    return JSON.stringify({
      eventType: this.eventType,
      payload: this.payload,
      metadata: this.metadata,
    });
  }

  /**
   * Deserializes a JSON string to an event instance
   * @param EventClass Event class to instantiate
   * @param jsonString JSON string to deserialize
   * @returns Instance of the event class
   */
  public static deserialize<E, P>(
    EventClass: new (payload?: P, metadata?: IIntegrationEventMetadata) => E,
    jsonString: string
  ): E {
    const data = JSON.parse(jsonString);
    return new EventClass(data.payload, data.metadata);
  }
}
