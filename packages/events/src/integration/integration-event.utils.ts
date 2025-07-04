/* eslint-disable @typescript-eslint/no-explicit-any */
import { LibUtils } from '@vytches-ddd/utils';

import type { IIntegrationEvent, IIntegrationEventMetadata } from './integration-event-interfaces';

/**
 * Creates a new integration event with basic metadata
 * @param eventType Type of the event
 * @param payload Payload of the event
 * @param metadata Optional additional metadata
 * @returns A complete integration event with metadata
 */
export function createIntegrationEvent<P = any>(
  eventType: string,
  payload: P,
  metadata?: Partial<IIntegrationEventMetadata>
): IIntegrationEvent<P> {
  return {
    eventType,
    payload,
    metadata: {
      eventId: LibUtils.getUUID(),
      timestamp: new Date(),
      schemaVersion: 1,
      ...metadata,
    },
  };
}

/**
 * Serializes an integration event to JSON
 * @param event Integration event to serialize
 * @returns Serialized event as JSON string
 */
export function serializeIntegrationEvent<P = any>(event: IIntegrationEvent<P>): string {
  return JSON.stringify(event);
}

/**
 * Deserializes JSON to an integration event object
 * @param jsonString JSON string to deserialize
 * @returns Integration event object
 */
export function deserializeIntegrationEvent<P = any>(jsonString: string): IIntegrationEvent<P> {
  return JSON.parse(jsonString);
}

/**
 * Generates an idempotency key for an event
 * @param event Integration event
 * @returns Idempotency key
 */
export function generateIdempotencyKey<P = any>(event: IIntegrationEvent<P>): string {
  if (event.metadata?.idempotencyKey) {
    return event.metadata.idempotencyKey as string;
  }

  // If no key exists, generate one based on event ID and type
  return `${event.metadata?.eventId || LibUtils.getUUID()}_${event.eventType}`;
}
