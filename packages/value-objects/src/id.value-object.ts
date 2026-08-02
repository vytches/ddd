// ddd-lint-disable no-throw-in-domain
// Reason: throwing factory methods (fromUUID/fromInteger/fromBigInt/fromText)
// are intentionally kept for backward compatibility. Result-based variants
// (tryFromUUID/tryFromInteger/tryFromBigInt/tryFromText) live alongside each
// on EntityId in this same file for new code that prefers Result<T, E>. Per
// the library design decision in README ("throwing reserved for true
// programmer errors"), passing malformed primitives to a factory is a
// programmer error, not a domain error — identical rationale to
// `@vytches/ddd-contracts/entity-id.implementation.ts`, this package's base
// class. The remaining throw in `validate()` is an exhaustive switch over
// the closed IdType union (uuid|integer|bigint|text) — an unreachable
// default, not a domain-validation throw. Confirmed during VF-026
// (SEC-AUDIT-2026-07-09 SA-M1) triage.
//
// VF-024 (AC3): the deprecated `EntityIdFactory` wrapper class (runtime-warn
// since REL-005) was removed here pre-1.0 — see CHANGELOG.md. Use the
// `EntityId` static factory methods directly instead.
import { EntityId as BaseEntityId, type IdType } from '@vytches/ddd-contracts';
import { InvalidParameterError, MissingValueError } from '@vytches/ddd-domain-primitives';
import { LibUtils, Result } from '@vytches/ddd-utils';

export class EntityId<T = string> extends BaseEntityId<T> {
  constructor(value: T, type: IdType) {
    super(value, type);
  }

  override validate(value: T): boolean {
    switch (this.getType()) {
      case 'uuid':
        return LibUtils.isValidUUID(value as unknown as string);
      case 'integer':
        return LibUtils.isValidInteger(value as unknown as number);
      case 'bigint':
        return LibUtils.isValidBigInt(value as unknown as string);
      case 'text':
        return LibUtils.isValidTextId(value as unknown as string);
      default:
        throw new InvalidParameterError(`Unsupported IdType: ${this.getType()}`);
    }
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
  static override create(): EntityId<string> {
    return new EntityId(LibUtils.getUUID(), 'uuid');
  }

  /**
   * @deprecated Use `create()` instead. Will be removed in next major version.
   */
  static override createWithRandomUUID(): EntityId<string> {
    return EntityId.create();
  }

  /**
   * @returns EntityId instance
   * @throws {MissingValueError} if value is empty
   * @throws {InvalidParameterError} if value is not a valid UUID
   */
  static override fromUUID(value: string): EntityId<string> {
    if (!LibUtils.hasValue(value)) {
      throw MissingValueError.withValue('entity identifier');
    }

    if (!LibUtils.isValidUUID(value)) {
      throw InvalidParameterError.withParameter('entity identifier');
    }

    return new EntityId(value, 'uuid');
  }

  static override fromInteger(value: number): EntityId<string> {
    if (!LibUtils.isValidInteger(value)) {
      throw InvalidParameterError.withParameter('entity identifier must be a non-negative integer');
    }

    return new EntityId(value.toString(), 'integer');
  }

  static override fromBigInt(value: string | bigint): EntityId<string> {
    const stringValue = LibUtils.normalizeIdToString(value);

    if (!LibUtils.isValidBigInt(stringValue)) {
      throw InvalidParameterError.withParameter('entity identifier must be a valid bigint');
    }

    return new EntityId(stringValue, 'bigint');
  }

  static override fromText(value: string): EntityId<string> {
    if (!LibUtils.hasValue(value)) {
      throw MissingValueError.withValue('entity identifier');
    }

    if (!LibUtils.isValidTextId(value)) {
      throw InvalidParameterError.withParameter('entity identifier contains invalid characters');
    }

    return new EntityId(value, 'text');
  }

  // --- Result-returning factory methods (non-throwing) ---

  /**
   * Create EntityId from UUID string, returning Result instead of throwing.
   * @public
   * @stable
   * @since 0.24.0
   */
  static tryFromUUID(value: string): Result<EntityId<string>, Error> {
    if (!LibUtils.hasValue(value)) {
      return Result.fail(MissingValueError.withValue('entity identifier'));
    }
    if (!LibUtils.isValidUUID(value)) {
      return Result.fail(InvalidParameterError.withParameter('entity identifier'));
    }
    return Result.ok(new EntityId(value, 'uuid'));
  }

  /**
   * Create EntityId from integer, returning Result instead of throwing.
   * @public
   * @stable
   * @since 0.24.0
   */
  static tryFromInteger(value: number): Result<EntityId<string>, Error> {
    if (!LibUtils.isValidInteger(value)) {
      return Result.fail(
        InvalidParameterError.withParameter('entity identifier must be a non-negative integer')
      );
    }
    return Result.ok(new EntityId(value.toString(), 'integer'));
  }

  /**
   * Create EntityId from bigint, returning Result instead of throwing.
   * @public
   * @stable
   * @since 0.24.0
   */
  static tryFromBigInt(value: string | bigint): Result<EntityId<string>, Error> {
    const stringValue = LibUtils.normalizeIdToString(value);
    if (!LibUtils.isValidBigInt(stringValue)) {
      return Result.fail(
        InvalidParameterError.withParameter('entity identifier must be a valid bigint')
      );
    }
    return Result.ok(new EntityId(stringValue, 'bigint'));
  }

  /**
   * Create EntityId from text, returning Result instead of throwing.
   * @public
   * @stable
   * @since 0.24.0
   */
  static tryFromText(value: string): Result<EntityId<string>, Error> {
    if (!LibUtils.hasValue(value)) {
      return Result.fail(MissingValueError.withValue('entity identifier'));
    }
    if (!LibUtils.isValidTextId(value)) {
      return Result.fail(
        InvalidParameterError.withParameter('entity identifier contains invalid characters')
      );
    }
    return Result.ok(new EntityId(value, 'text'));
  }
}
