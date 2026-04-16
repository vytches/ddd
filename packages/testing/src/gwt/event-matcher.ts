import type { IDomainEvent } from '@vytches/ddd-contracts';

/**
 * Compare two events structurally: same eventName + deep-equal payload.
 * Ignores metadata (timestamp, eventId, correlationId) for testing purposes.
 *
 * @public
 * @stable
 * @since 0.24.0
 */
export function eventsMatch(expected: IDomainEvent, actual: IDomainEvent): boolean {
  if (expected.eventName !== actual.eventName) {
    return false;
  }

  return deepEqual(expected.payload, actual.payload);
}

/**
 * Compare event arrays structurally (order matters).
 *
 * @public
 * @stable
 * @since 0.24.0
 */
export function eventArraysMatch(
  expected: ReadonlyArray<IDomainEvent>,
  actual: ReadonlyArray<IDomainEvent>
): boolean {
  if (expected.length !== actual.length) {
    return false;
  }

  return expected.every((exp, i) => {
    const act = actual[i];
    return act !== undefined && eventsMatch(exp, act);
  });
}

/**
 * Partial event matcher — checks type + subset of payload fields.
 *
 * @public
 * @stable
 * @since 0.24.0
 *
 * @example
 * ```typescript
 * Test(Order)
 *   .given(...)
 *   .when(order => order.place(items))
 *   .then(matching(OrderPlaced, { itemCount: 2 }));
 * ```
 */
export function matching(
  eventClass: new (...args: never[]) => IDomainEvent,
  partialPayload: Record<string, unknown>
): IDomainEvent {
  const eventName = eventClass.name;
  return {
    eventName,
    payload: partialPayload,
    metadata: { _partial: true } as unknown as import('@vytches/ddd-contracts').IEventMetadata,
  };
}

/**
 * Check if an event was created with matching() for partial comparison.
 */
export function isPartialMatch(event: IDomainEvent): boolean {
  return (event.metadata as Record<string, unknown>)?._partial === true;
}

/**
 * Compare a partial-match event against an actual event.
 */
export function partialEventMatches(expected: IDomainEvent, actual: IDomainEvent): boolean {
  if (expected.eventName !== actual.eventName) {
    return false;
  }

  if (!expected.payload || !actual.payload) {
    return expected.payload === actual.payload;
  }

  const expectedPayload = expected.payload as Record<string, unknown>;
  const actualPayload = actual.payload as Record<string, unknown>;

  for (const key of Object.keys(expectedPayload)) {
    if (!deepEqual(expectedPayload[key], actualPayload[key])) {
      return false;
    }
  }

  return true;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(key => deepEqual(aObj[key], bObj[key]));
  }

  return false;
}
