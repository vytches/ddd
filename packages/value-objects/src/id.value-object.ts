import {
  EntityId as BaseEntityId,
  type IEntityIdFactory,
  type IdType,
} from '@vytches/ddd-contracts';
import { InvalidParameterError, MissingValueError } from '@vytches/ddd-domain-primitives';
import { LibUtils } from '@vytches/ddd-utils';

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
   * @deprecated Use EntityId.create() instead
   */
  static createWithRandomUUID(): EntityId<string> {
    return EntityId.create();
  }

  /**
   * @deprecated Use EntityId.fromUUID() instead
   * @throws {MissingValueError} if value is empty
   * @throws {InvalidParameterError} if value is empty
   */
  static fromUUID(value: string): EntityId<string> {
    if (!LibUtils.hasValue(value)) {
      throw MissingValueError.withValue('entity identifier');
    }

    if (!LibUtils.isValidUUID(value)) {
      throw InvalidParameterError.withParameter('entity identifier');
    }

    return new EntityId(value, 'uuid');
  }

  /**
   * @deprecated Use EntityId.fromInteger() instead
   * @throws {InvalidParameterError} if value is empty
   */
  static fromInteger(value: number): EntityId<string> {
    if (!LibUtils.isValidInteger(value)) {
      throw InvalidParameterError.withParameter('entity identifier must be a non-negative integer');
    }

    return new EntityId(value.toString(), 'integer');
  }

  /**
   * @deprecated Use EntityId.fromBigInt() instead
   * @throws {InvalidParameterError} if value is empty
   */
  static fromBigInt(value: string | bigint): EntityId<string> {
    const stringValue = LibUtils.normalizeIdToString(value);

    if (!LibUtils.isValidBigInt(stringValue)) {
      throw InvalidParameterError.withParameter('entity identifier must be a valid bigint');
    }

    return new EntityId(stringValue, 'bigint');
  }

  /**
   * @deprecated Use EntityId.fromText() instead
   * @throws {MissingValueError} if value is empty
   * @throws {InvalidParameterError} if value is empty
   */
  static fromText(value: string): EntityId<string> {
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
