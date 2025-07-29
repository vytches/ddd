import { LibUtils } from '@vytches/ddd-utils';
import type { IExtendedDomainEvent, IEventMetadata } from './domain-event-interfaces';

/**
 * @llm-summary create domain event function
 * @llm-domain Core
 * @llm-pure false
 *
 * @description
 * createDomainEvent function implementing core domain functionality for create domain event operations.
 *
 * @param {string} eventType - eventType parameter
 * @param {P} payload - payload parameter
 * @param {Partial<IEventMetadata>} metadata? - metadata? parameter
 * @returns {IExtendedDomainEvent<P>} Returns IExtendedDomainEvent<P>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = createDomainEvent(eventType, payload, metadata?);
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export function createDomainEvent<P = unknown>(
  eventType: string,
  payload: P,
  metadata?: Partial<IEventMetadata>
): IExtendedDomainEvent<P> {
  return {
    eventType,
    payload,
    metadata: {
      eventId: LibUtils.getUUID(),
      timestamp: new Date(),
      ...metadata,
    },
  };
}
