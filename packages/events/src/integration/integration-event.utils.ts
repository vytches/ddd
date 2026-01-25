/* eslint-disable @typescript-eslint/no-explicit-any */
import { LibUtils } from '@vytches/ddd-utils';

import type { IIntegrationEvent, IIntegrationEventMetadata } from './integration-event-interfaces';

export function createIntegrationEvent<P = unknown>(
  eventName: string,
  payload: P,
  metadata?: Partial<IIntegrationEventMetadata>
): IIntegrationEvent<P> {
  return {
    eventName,
    payload,
    metadata: {
      eventId: LibUtils.getUUID(),
      timestamp: new Date(),
      schemaVersion: 1,
      ...metadata,
    },
  };
}

export function serializeIntegrationEvent<P = unknown>(event: IIntegrationEvent<P>): string {
  return JSON.stringify(event);
}

export function deserializeIntegrationEvent<P = unknown>(jsonString: string): IIntegrationEvent<P> {
  return JSON.parse(jsonString);
}

export function generateIdempotencyKey<P = unknown>(event: IIntegrationEvent<P>): string {
  if (event.metadata?.idempotencyKey) {
    return event.metadata.idempotencyKey as string;
  }

  // If no key exists, generate one based on event ID and type
  return `${event.metadata?.eventId || LibUtils.getUUID()}_${event.eventName}`;
}
