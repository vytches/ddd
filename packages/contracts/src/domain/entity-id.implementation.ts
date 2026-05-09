// ddd-lint-disable no-throw-in-domain
// Reason: throwing factory methods (fromUUID/fromInteger/fromBigInt/fromText)
// are intentionally kept for backward compatibility. Result-based variants
// `tryFromUUID`, `tryFromInteger`, `tryFromBigInt`, `tryFromText` live in
// `@vytches/ddd-value-objects/result-factories.ts` for new code that
// prefers Result<T, E> for invalid-input handling. Per the library design
// decision in README ("throwing reserved for true programmer errors"),
// passing malformed primitives to a factory is a programmer error, not a
// domain error.

import type { IEntityId, IdType } from './entity-id.interfaces';

/**
 * Base implementation of {@link IEntityId} — the typed identifier used by
 * every aggregate, entity, and value object in the framework. Holds a
 * `value: T` plus a discriminating `type: IdType` (`'text' | 'uuid' |
 * 'integer' | 'bigint'`) so that "the same string under different id
 * conventions" never compares as equal by accident.
 *
 * **Two-tier design.** This base `EntityId` from `@vytches/ddd-contracts`
 * has minimal validation — it accepts what its constructor is given. The
 * extended `EntityId` from `@vytches/ddd-value-objects` adds strict
 * format validation (UUID regex, BigInt parsing, text safe-char rules)
 * and is what application code should use. Library packages depend on
 * this base so they don't pull value-objects into the contracts layer.
 *
 * Identity-based equality: two ids are equal only if both `value` *and*
 * `type` match. Cross-type comparison always returns false.
 *
 * Static factories cover the common id flavors:
 *
 * - `create()` → random UUID v4 (no external dependency)
 * - `fromUUID(s)` → typed UUID with regex validation
 * - `fromInteger(n)` → non-negative integer wrapped as string
 * - `fromBigInt(v)` → BigInt or numeric string
 * - `fromText(s)` → safe-char text id (`[a-zA-Z0-9_-]+`)
 *
 * The deprecated `createXxx` aliases predate this naming and will be
 * removed in the next major release.
 *
 * @example Standard usage
 * ```typescript
 * import { EntityId } from '@vytches/ddd-contracts';
 *
 * const a = EntityId.create();                // random UUID
 * const b = EntityId.fromText('order-42');    // text id
 * const c = EntityId.fromInteger(42);         // numeric id
 *
 * a.equals(EntityId.create());                // false
 * b.equals(EntityId.fromText('order-42'));    // true
 * b.equals(EntityId.fromInteger(42));         // false (different type)
 * ```
 *
 * @example Use in an aggregate
 * ```typescript
 * class Order extends AggregateRoot<string> {
 *   constructor(params: IAggregateConstructorParams<string>) {
 *     super(params);
 *   }
 *   static create(): Order {
 *     return new Order({ id: EntityId.create(), version: 0 });
 *   }
 * }
 * ```
 *
 * @public
 * @stable
 * @since 0.1.0
 */
export class EntityId<T = string> implements IEntityId<T> {
  constructor(
    public readonly value: T,
    private readonly type: IdType = 'text'
  ) {}

  /**
   * Returns the stored identifier value
   * @returns The identifier value
   * @example
   * ```typescript
   * const id = EntityId.fromText('user-123');
   * const value = id.getValue(); // Returns: 'user-123'
   * ```
   */
  getValue(): T {
    return this.value;
  }

  /**
   * Returns the identifier type (text, uuid, integer, bigint)
   * @returns The identifier type
   * @example
   * ```typescript
   * const id = EntityId.fromUUID('550e8400-e29b-41d4-a716-446655440000');
   * const type = id.getType(); // Returns: 'uuid'
   * ```
   */
  getType(): IdType {
    return this.type;
  }

  validate(value: T): boolean {
    // Basic validation - can be overridden by implementations
    return value != null && value !== undefined;
  }

  /**
   * Compares this EntityId with another for equality
   * @returns True if entities have same value and type
   * @example
   * ```typescript
   * const id1 = EntityId.fromText('user-123');
   * const id2 = EntityId.fromText('user-123');
   * const isEqual = id1.equals(id2); // Returns: true
   * ```
   */
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
   * Primary factory method - creates a new EntityId with a randomly generated UUID
   * @returns New EntityId with random UUID
   * @example
   * ```typescript
   * const id = EntityId.create();
   * console.log(id.getValue()); // Returns: '550e8400-e29b-41d4-a716-446655440000'
   * ```
   */
  static create(): EntityId<string> {
    // Simple UUID generation without external dependencies
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    return new EntityId(uuid, 'uuid');
  }

  /**
   * @deprecated Use `fromText()` instead. Will be removed in next major version.
   */
  static createText<T = string>(value: T): EntityId<T> {
    return new EntityId(value, 'text');
  }

  /**
   * @deprecated Use `fromUUID()` instead. Will be removed in next major version.
   */
  static createUuid(value: string): EntityId<string> {
    return new EntityId(value, 'uuid');
  }

  /**
   * @deprecated Use `fromInteger()` instead. Will be removed in next major version.
   */
  static createInteger(value: number): EntityId<string> {
    return new EntityId(value.toString(), 'integer');
  }

  /**
   * @deprecated Use `fromBigInt()` instead. Will be removed in next major version.
   */
  static createBigInt(value: string | bigint): EntityId<string> {
    const stringValue = typeof value === 'bigint' ? value.toString() : value;
    return new EntityId(stringValue, 'bigint');
  }

  /**
   * @deprecated Use `create()` instead. Will be removed in next major version.
   * Creates a new EntityId with a randomly generated UUID
   * @returns New EntityId with random UUID
   */
  static createWithRandomUUID(): EntityId<string> {
    return EntityId.create();
  }

  /**
   * Creates an EntityId from a UUID string with validation
   * @returns EntityId from UUID string
   * @example
   * ```typescript
   * const id = EntityId.fromUUID('550e8400-e29b-41d4-a716-446655440000');
   * console.log(id.getType()); // Returns: 'uuid'
   * ```
   */
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

  /**
   * Creates an EntityId from a text string with validation
   * @returns EntityId from text string
   * @example
   * ```typescript
   * const id = EntityId.fromText('user-123');
   * console.log(id.getValue()); // Returns: 'user-123'
   * ```
   */
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
