/* eslint-disable @typescript-eslint/no-explicit-any */
import { LibUtils } from '@vytches/ddd-utils';

import type { IIntegrationEvent, IIntegrationEventMetadata } from './integration-event-interfaces';

/**
 * Maximum allowed JSON string size for deserialization (1 MB).
 * @internal
 */
export const MAX_DESERIALIZE_SIZE = 1_048_576;

/**
 * Maximum recursion depth for `sanitizeObject` (REL-007 — prevents stack
 * overflow from maliciously deep JSON payloads).
 * @internal
 */
export const MAX_SANITIZE_DEPTH = 50;

/**
 * Recursively strip dangerous prototype-pollution keys (`__proto__`,
 * `constructor`, `prototype`) from a parsed JSON object. Bounded by
 * `MAX_SANITIZE_DEPTH` to prevent stack overflow on adversarial payloads.
 *
 * REL-007 (2026-05-08): added `maxDepth` parameter — was unbounded.
 *
 * @internal
 * @throws Error if recursion exceeds `maxDepth`
 */
export function sanitizeIntegrationPayload<T>(
  obj: T,
  maxDepth: number = MAX_SANITIZE_DEPTH,
  currentDepth: number = 0
): T {
  if (currentDepth > maxDepth) {
    throw new Error(
      `Integration event payload exceeds maximum nesting depth of ${maxDepth}. ` +
        `This may indicate a malformed or malicious payload.`
    );
  }
  if (obj === null || typeof obj !== 'object') return obj;
  const clean = (Array.isArray(obj) ? [] : {}) as Record<string, unknown>;
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    clean[key] = sanitizeIntegrationPayload(
      (obj as Record<string, unknown>)[key],
      maxDepth,
      currentDepth + 1
    );
  }
  return clean as T;
}

/**
 * Safely parse + sanitize a JSON string for integration event deserialization.
 * Enforces 1 MB size cap and 50-level depth cap.
 *
 * @internal
 * @throws Error if size or depth limits exceeded, or JSON is invalid
 */
export function safeParseIntegrationJson<T = unknown>(jsonString: string): T {
  // REL-007 (post-review fix): use Buffer.byteLength for strict byte bound.
  // String.length returns UTF-16 code units; a string with length === 1M
  // can be 1-4 MB UTF-8 with emoji or CJK characters. The cap is supposed
  // to be a strict 1 MB byte limit, so measure actual bytes.
  // Fallback to TextEncoder for non-Node environments (browser, Workers).
  const byteLength =
    typeof Buffer !== 'undefined'
      ? Buffer.byteLength(jsonString, 'utf8')
      : new TextEncoder().encode(jsonString).length;

  if (byteLength > MAX_DESERIALIZE_SIZE) {
    throw new Error(
      `Event payload exceeds maximum size of ${MAX_DESERIALIZE_SIZE} bytes (actual: ${byteLength})`
    );
  }
  return sanitizeIntegrationPayload(JSON.parse(jsonString)) as T;
}

/**
 * @public
 * @stable
 * @since 0.22.0
 */
export abstract class IntegrationEvent<T = unknown> implements IIntegrationEvent<T> {
  /**
   * Unique identifier for the event
   */
  public readonly eventId: string;

  /**
   * When the event was created
   */
  public readonly timestamp: Date;

  /**
   * Name of the event, defaults to the class name
   */
  public readonly eventName: string;

  /**
   * Payload of the event
   */
  public readonly payload?: T | undefined;

  /**
   * Metadata of the event
   */
  public readonly metadata?: IIntegrationEventMetadata;

  /**
   * Creates a new integration event
   *
   * @param payload - The event data
   * @param metadata - Optional metadata for the event
   */
  constructor(payload?: T, metadata?: IIntegrationEventMetadata) {
    this.eventId = IntegrationEvent.generateId();
    this.timestamp = new Date();
    this.eventName = this.constructor.name;
    this.payload = payload;

    this.metadata = {
      eventId: this.eventId,
      timestamp: this.timestamp,
      schemaVersion: 1, // Default schema version
      ...(metadata || {}),
    };
  }

  /**
   * Generates a unique identifier for the event
   * This is a simple implementation that can be replaced in production
   */
  protected static generateId(): string {
    return LibUtils.getUUID();
  }

  /**
   * Creates a copy of this event with additional metadata
   *
   * @param metadata - Metadata to merge with existing metadata
   * @returns A new event instance with combined metadata
   */
  public withMetadata(metadata: Partial<IIntegrationEventMetadata>): IntegrationEvent<T> {
    const EventClass = this.constructor as new (
      payload?: T,
      metadata?: IIntegrationEventMetadata
    ) => IntegrationEvent<T>;

    return new EventClass(this.payload, {
      ...this.metadata,
      ...metadata,
    });
  }

  /**
   * Serializes the event to JSON format
   * @returns Serialized event as JSON string
   */
  public serialize(): string {
    return JSON.stringify({
      eventName: this.eventName,
      payload: this.payload,
      metadata: this.metadata,
    });
  }

  /**
   * Deserializes a JSON string to an event instance
   * @param EventClass Event class to instantiate
   * @param jsonString JSON string to deserialize
   * @returns Instance of the event class
   */
  /**
   * @deprecated Use module-level `MAX_DESERIALIZE_SIZE`. Kept as a static
   * property for backward compatibility with consumers reading
   * `IntegrationEvent.MAX_DESERIALIZE_SIZE` directly.
   */
  private static readonly MAX_DESERIALIZE_SIZE = MAX_DESERIALIZE_SIZE;

  /**
   * @deprecated Use module-level `sanitizeIntegrationPayload`. Kept as a
   * thin shim — REL-007 unified the implementation so the class-based
   * deserializer and the utility function share the same sanitizer
   * (with depth limit, size cap, and prototype-pollution protection).
   */
  private static sanitizeObject<T>(obj: T): T {
    return sanitizeIntegrationPayload(obj);
  }

  public static deserialize<E, P>(
    EventClass: new (payload?: P, metadata?: IIntegrationEventMetadata) => E,
    jsonString: string
  ): E {
    const data = safeParseIntegrationJson<{ payload?: P; metadata?: IIntegrationEventMetadata }>(
      jsonString
    );
    return new EventClass(data.payload, data.metadata);
  }
}
