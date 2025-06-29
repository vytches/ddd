import { LibUtils } from '@vytches-ddd/utils';
import type { IExtendedDomainEvent, IEventMetadata } from './domain-event-interfaces';

/**
 * Creates a new domain event with basic metadata
 * @param eventType Type of the event
 * @param payload Event payload
 * @param metadata Optional additional metadata
 * @returns A complete domain event with metadata
 */
export function createDomainEvent<P = any>(
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
