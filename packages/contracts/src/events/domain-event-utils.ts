import { LibUtils } from '@vytches/ddd-utils';
import type { IEventMetadata, IExtendedDomainEvent } from './domain-event-interfaces';

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
