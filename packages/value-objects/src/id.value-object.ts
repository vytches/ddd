import {
  EntityId as BaseEntityId,
  type IEntityIdFactory,
  type IdType,
} from '@vytches/ddd-contracts';
import { InvalidParameterError, MissingValueError } from '@vytches/ddd-domain-primitives';
import { LibUtils, Result } from '@vytches/ddd-utils';

/**
 * Tracks deprecation warnings so each deprecated method warns at most once
 * per process (otherwise tight loops would flood logs).
 *
 * @internal
 */
const _entityIdFactoryWarned = new Set<string>();

/**
 * Emit a one-time deprecation warning for an EntityIdFactory call site.
 *
 * Why a runtime warning (not just JSDoc): TypeScript's `@deprecated` is a
 * compile-time hint — consumers using `tsc` without `--strict` or those who
 * ignore IDE squiggles never see it. A console.warn at first call ensures
 * the message reaches everyone running the code.
 *
 * REL-005 (2026-05-08): EntityIdFactory will be removed in v1.0.0. Until
 * then this warning fires once per method per process.
 *
 * @internal
 */
function warnEntityIdFactoryDeprecation(method: string, replacement: string): void {
  if (_entityIdFactoryWarned.has(method)) return;
  _entityIdFactoryWarned.add(method);
  // eslint-disable-next-line no-console
  console.warn(
    `[@vytches/ddd-value-objects] EntityIdFactory.${method}() is deprecated and will be removed in v1.0.0. ` +
      `Use ${replacement} instead. ` +
      `See https://github.com/vytches/ddd/blob/main/CHANGELOG.md for migration details.`
  );
}

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

/**
 * @deprecated Use EntityId static methods directly instead. This class will be removed in the next major version.
 * @example
 * ```typescript
 * // Before (deprecated):
 * const id = EntityIdFactory.createWithRandomUUID();
 *
 * // After (recommended):
 * const id = EntityId.create();
 * ```
 */
export class EntityIdFactory implements IEntityIdFactory {
  /**
   * @deprecated Use EntityId.create() instead. Will be removed in v1.0.0.
   */
  static createWithRandomUUID(): EntityId<string> {
    warnEntityIdFactoryDeprecation('createWithRandomUUID', 'EntityId.create()');
    return EntityId.create();
  }

  /**
   * @deprecated Use EntityId.fromUUID() instead. Will be removed in v1.0.0.
   * @throws {MissingValueError} if value is empty
   * @throws {InvalidParameterError} if value is empty
   */
  static fromUUID(value: string): EntityId<string> {
    warnEntityIdFactoryDeprecation('fromUUID', 'EntityId.fromUUID()');
    if (!LibUtils.hasValue(value)) {
      throw MissingValueError.withValue('entity identifier');
    }

    if (!LibUtils.isValidUUID(value)) {
      throw InvalidParameterError.withParameter('entity identifier');
    }

    return new EntityId(value, 'uuid');
  }

  /**
   * @deprecated Use EntityId.fromInteger() instead. Will be removed in v1.0.0.
   * @throws {InvalidParameterError} if value is empty
   */
  static fromInteger(value: number): EntityId<string> {
    warnEntityIdFactoryDeprecation('fromInteger', 'EntityId.fromInteger()');
    if (!LibUtils.isValidInteger(value)) {
      throw InvalidParameterError.withParameter('entity identifier must be a non-negative integer');
    }

    return new EntityId(value.toString(), 'integer');
  }

  /**
   * @deprecated Use EntityId.fromBigInt() instead. Will be removed in v1.0.0.
   * @throws {InvalidParameterError} if value is empty
   */
  static fromBigInt(value: string | bigint): EntityId<string> {
    warnEntityIdFactoryDeprecation('fromBigInt', 'EntityId.fromBigInt()');
    const stringValue = LibUtils.normalizeIdToString(value);

    if (!LibUtils.isValidBigInt(stringValue)) {
      throw InvalidParameterError.withParameter('entity identifier must be a valid bigint');
    }

    return new EntityId(stringValue, 'bigint');
  }

  /**
   * @deprecated Use EntityId.fromText() instead. Will be removed in v1.0.0.
   * @throws {MissingValueError} if value is empty
   * @throws {InvalidParameterError} if value is empty
   */
  static fromText(value: string): EntityId<string> {
    warnEntityIdFactoryDeprecation('fromText', 'EntityId.fromText()');
    if (!LibUtils.hasValue(value)) {
      throw MissingValueError.withValue('entity identifier');
    }

    if (!LibUtils.isValidTextId(value)) {
      throw InvalidParameterError.withParameter('entity identifier contains invalid characters');
    }

    return new EntityId(value, 'text');
  }

  /** @deprecated Use EntityId.create() instead */
  createWithRandomUUID(): EntityId<string> {
    return EntityId.create();
  }

  /** @deprecated Use EntityId.fromUUID() instead */
  fromUUID(value: string): EntityId<string> {
    return EntityIdFactory.fromUUID(value);
  }

  /** @deprecated Use EntityId.fromInteger() instead */
  fromInteger(value: number): EntityId<string> {
    return EntityIdFactory.fromInteger(value);
  }

  /** @deprecated Use EntityId.fromBigInt() instead */
  fromBigInt(value: string | bigint): EntityId<string> {
    return EntityIdFactory.fromBigInt(value);
  }

  /** @deprecated Use EntityId.fromText() instead */
  fromText(value: string): EntityId<string> {
    return EntityIdFactory.fromText(value);
  }
}
