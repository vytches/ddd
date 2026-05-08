import type { IEventMetadata, IDomainEvent } from './domain-event-interfaces';

/**
 * Generate a UUID v4 using the platform crypto API.
 *
 * `globalThis.crypto.randomUUID()` is available in:
 *   - Node.js >= 19 (standard, no import required)
 *   - All modern browsers (Web Crypto)
 *   - Cloudflare Workers / Deno / Bun
 *
 * The library's `engines.node >= 22.19.0` ensures availability.
 * Using globalThis avoids importing `node:crypto`, which Vite externalizes
 * for browser-compat builds and breaks the contracts foundation bundle.
 */
function generateEventId(): string {
  return globalThis.crypto.randomUUID();
}

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
      eventId: generateEventId(),
      timestamp: new Date(),
      ...metadata,
    },
  };
}
