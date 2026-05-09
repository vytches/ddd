/* eslint-disable @typescript-eslint/no-explicit-any */
import { LibUtils } from '@vytches/ddd-utils';

import { safeParseIntegrationJson } from './integration-event';
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

/**
 * Deserialize a JSON string back into an integration event.
 *
 * REL-007 (2026-05-08): now enforces the same protections as
 * `IntegrationEvent.deserialize()` — 1 MB size cap, prototype-pollution
 * sanitization, and 50-level recursion depth limit. Previously this
 * function called `JSON.parse` directly with no protections, making it a
 * vector for prototype pollution and DoS via deeply nested payloads.
 *
 * @throws Error if payload exceeds 1 MB, exceeds 50-level depth, or JSON
 *   is invalid
 */
export function deserializeIntegrationEvent<P = unknown>(jsonString: string): IIntegrationEvent<P> {
  return safeParseIntegrationJson<IIntegrationEvent<P>>(jsonString);
}

export function generateIdempotencyKey<P = unknown>(event: IIntegrationEvent<P>): string {
  if (event.metadata?.idempotencyKey) {
    return event.metadata.idempotencyKey as string;
  }

  // If no key exists, generate one based on event ID and type
  return `${event.metadata?.eventId || LibUtils.getUUID()}_${event.eventName}`;
}
