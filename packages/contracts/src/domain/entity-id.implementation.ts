/**
 * Enterprise-grade EntityId implementation
 * This is the fundamental building block for all entity identifiers in the DDD framework
 */

import type { IEntityId, IEntityIdConstructorParams, IdType } from './entity-id.interfaces';

/**
 * @llm-summary EntityId class for entity id operations
 * @llm-domain Core
 * @llm-complexity Medium
 *
 * @description
 * EntityId class implementing core domain functionality for entity id operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new EntityId();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class EntityId<T = string> implements IEntityId<T> {
  constructor(
    public readonly value: T,
    private readonly type: IdType = 'text'
  ) {}

  getValue(): T {
    return this.value;
  }

  getType(): IdType {
    return this.type;
  }

  validate(value: T): boolean {
    // Basic validation - can be overridden by implementations
    return value != null && value !== undefined;
  }

  equals(other: IEntityId<T>): boolean {
    return other.getValue() === this.value && other.getType() === this.type;
  }

  isType(type: IdType): boolean {
    return this.type === type;
  }

  toString(): string {
    return String(this.value);
  }

  toJSON(): string {
    return JSON.stringify({
      value: this.value,
      type: this.type,
    });
  }

  /**
   * Static factory methods for common EntityId types
   */
  static createText<T = string>(value: T): EntityId<T> {
    return new EntityId(value, 'text');
  }

  static createUuid(value: string): EntityId<string> {
    return new EntityId(value, 'uuid');
  }

  static createInteger(value: number): EntityId<string> {
    return new EntityId(value.toString(), 'integer');
  }

  static createBigInt(value: string | bigint): EntityId<string> {
    const stringValue = typeof value === 'bigint' ? value.toString() : value;
    return new EntityId(stringValue, 'bigint');
  }

  // Compatibility methods for existing code
  static createWithRandomUUID(): EntityId<string> {
    // Simple UUID generation without external dependencies
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    return new EntityId(uuid, 'uuid');
  }

  static fromUUID(value: string): EntityId<string> {
    if (!value || typeof value !== 'string') {
      throw new Error('entity identifier must be provided');
    }
    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error('entity identifier must be valid UUID');
    }
    return new EntityId(value, 'uuid');
  }

  static fromInteger(value: number): EntityId<string> {
    if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
      throw new Error('entity identifier must be a non-negative integer');
    }
    return new EntityId(value.toString(), 'integer');
  }

  static fromBigInt(value: string | bigint): EntityId<string> {
    const stringValue = typeof value === 'bigint' ? value.toString() : value;
    if (!stringValue || typeof stringValue !== 'string') {
      throw new Error('entity identifier must be a valid bigint');
    }
    return new EntityId(stringValue, 'bigint');
  }

  static fromText(value: string): EntityId<string> {
    if (!value || typeof value !== 'string') {
      throw new Error('entity identifier must be provided');
    }
    // Basic text validation - no special chars
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      throw new Error('entity identifier contains invalid characters');
    }
    return new EntityId(value, 'text');
  }
}
