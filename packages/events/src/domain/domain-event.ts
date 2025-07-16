import type { IEventMetadata, IExtendedDomainEvent } from '@vytches-ddd/contracts';
import { LibUtils } from '@vytches-ddd/utils';

/**
 * @llm-summary DomainEvent class for domain event operations
 * @llm-domain Architecture
 * @llm-complexity Medium
 *
 * @description
 * DomainEvent class implementing architectural component for domain event operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new DomainEvent();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new DomainEvent());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class DomainEvent<T = unknown> implements IExtendedDomainEvent<T> {
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
