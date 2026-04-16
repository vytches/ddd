import { LibUtils } from '@vytches/ddd-utils';
import type { IEventMetadata, IDomainEvent } from './domain-event-interfaces';

/**
 * Factory function for creating domain events with auto-generated metadata.
 * @public
 * @stable
 * @since 0.22.0
 */
export function createDomainEvent<P = unknown>(
  eventName: string,
  payload: P,
  metadata?: Partial<IEventMetadata>
): IDomainEvent<P> {
  return {
    eventName,
    payload,
    metadata: {
      eventId: LibUtils.getUUID(),
      timestamp: new Date(),
      ...metadata,
    },
  };
}
