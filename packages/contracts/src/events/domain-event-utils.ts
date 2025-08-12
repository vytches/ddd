import { LibUtils } from '@vytches/ddd-utils';
import type { IEventMetadata, IDomainEvent } from './domain-event-interfaces';

export function createDomainEvent<P = unknown>(
  eventType: string,
  payload: P,
  metadata?: Partial<IEventMetadata>
): IDomainEvent<P> {
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
