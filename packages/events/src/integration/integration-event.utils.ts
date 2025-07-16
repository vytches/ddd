/* eslint-disable @typescript-eslint/no-explicit-any */
import { LibUtils } from '@vytches-ddd/utils';

import type { IIntegrationEvent, IIntegrationEventMetadata } from './integration-event-interfaces';

/**
 * @llm-summary create integration event function
 * @llm-domain Architecture
 * @llm-pure false
 *
 * @description
 * createIntegrationEvent function implementing architectural component for create integration event operations.
 *
 *
 * @param {string} eventType - eventType parameter
 * @param {P} payload - payload parameter
 * @param {Partial<IIntegrationEventMetadata>} metadata? - metadata? parameter
 * @returns {IIntegrationEvent<P>} Returns IIntegrationEvent<P>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = createIntegrationEvent(eventType, payload, metadata?);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => createIntegrationEvent(eventType, payload, metadata?));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function createIntegrationEvent<P = unknown>(
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
 * @llm-summary serialize integration event function
 * @llm-domain Architecture
 * @llm-pure false
 *
 * @description
 * serializeIntegrationEvent function implementing architectural component for serialize integration event operations.
 *
 *
 * @param {IIntegrationEvent<P>} event - event parameter
 * @returns {string} Returns string
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = serializeIntegrationEvent(event);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => serializeIntegrationEvent(event));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function serializeIntegrationEvent<P = unknown>(event: IIntegrationEvent<P>): string {
  return JSON.stringify(event);
}

/**
 * @llm-summary deserialize integration event function
 * @llm-domain Architecture
 * @llm-pure false
 *
 * @description
 * deserializeIntegrationEvent function implementing architectural component for deserialize integration event operations.
 *
 *
 * @param {string} jsonString - jsonString parameter
 * @returns {IIntegrationEvent<P>} Returns IIntegrationEvent<P>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = deserializeIntegrationEvent(jsonString);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => deserializeIntegrationEvent(jsonString));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function deserializeIntegrationEvent<P = unknown>(jsonString: string): IIntegrationEvent<P> {
  return JSON.parse(jsonString);
}

/**
 * @llm-summary generate idempotency key function
 * @llm-domain Architecture
 * @llm-pure false
 *
 * @description
 * generateIdempotencyKey function implementing architectural component for generate idempotency key operations.
 *
 *
 * @param {IIntegrationEvent<P>} event - event parameter
 * @returns {string} Returns string
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = generateIdempotencyKey(event);
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, result] = safeRun(() => generateIdempotencyKey(event));
 * ```
 *
 * @since 1.0.0
 * @public
 */
export function generateIdempotencyKey<P = unknown>(event: IIntegrationEvent<P>): string {
  if (event.metadata?.idempotencyKey) {
    return event.metadata.idempotencyKey as string;
  }

  // If no key exists, generate one based on event ID and type
  return `${event.metadata?.eventId || LibUtils.getUUID()}_${event.eventType}`;
}
