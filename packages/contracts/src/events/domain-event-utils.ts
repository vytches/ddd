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
  const eventId = generateEventId();
  const occurredOn = new Date();

  return {
    eventName,
    payload,
    // Mirrored at the top level as well as in metadata: class based events
    // (`DomainEvent`) expose `eventId`/`occurredOn` directly, and code handling
    // both shapes should not have to know which one it was handed.
    eventId,
    occurredOn,
    metadata: {
      eventId,
      timestamp: occurredOn,
      ...metadata,
    },
  };
}

/**
 * Copy an event, replacing its payload and/or merging extra metadata, while
 * keeping its identity and its prototype.
 *
 * This is the supported way for infrastructure to stamp an event on its way
 * out of the aggregate — a crypto-shredding key id resolved at persistence
 * time, a correlation id assigned at dispatch, an encrypted payload. It is not
 * a domain operation: an aggregate records events through `apply()`, it does
 * not rewrite them.
 *
 * Unlike `DomainEvent.withMetadata()`, this preserves `eventId` and
 * `occurredOn` and never calls the event's constructor, so it is safe for
 * event classes that take their own constructor arguments. `Object.create` on
 * the original prototype keeps `instanceof` working for class based events and
 * is harmless for the plain objects produced by the string form of `apply()`.
 *
 * Events returned by `AggregateRoot.getDomainEvents()` are deep frozen; the
 * copy this returns is not, so it can be handed on and frozen again by the
 * caller.
 *
 * @public
 * @since 0.32.0
 */
export function enrichEvent<P = unknown>(
  event: Readonly<IDomainEvent<P>>,
  patch: { payload?: P; metadata?: Partial<IEventMetadata> }
): IDomainEvent<P> {
  return Object.assign(Object.create(Object.getPrototypeOf(event)) as IDomainEvent<P>, event, {
    payload: 'payload' in patch ? patch.payload : event.payload,
    metadata: patch.metadata ? { ...event.metadata, ...patch.metadata } : event.metadata,
  });
}
