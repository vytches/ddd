import { LibUtils } from '@vytches-ddd/utils';
import { InvalidParameterError, MissingValueError } from '@vytches-ddd/domain-primitives';
import {
  EntityId as BaseEntityId,
  type IEntityIdFactory,
  type IdType,
} from '@vytches-ddd/contracts';

/**
 * Enhanced EntityId implementation with additional validation and utilities
 * Extends the base EntityId from contracts with framework-specific functionality
 */
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
   * Enhanced factory methods with strict validation
   */
  static override createWithRandomUUID(): EntityId<string> {
    return new EntityId(LibUtils.getUUID(), 'uuid');
  }

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
 * Factory class for creating Entity IDs
 * Implements the IEntityIdFactory interface from contracts
 */
export class EntityIdFactory implements IEntityIdFactory {
  static createWithRandomUUID(): EntityId<string> {
    return new EntityId(LibUtils.getUUID(), 'uuid');
  }

  static fromUUID(value: string): EntityId<string> {
    if (!LibUtils.hasValue(value)) {
      throw MissingValueError.withValue('entity identifier');
    }

    if (!LibUtils.isValidUUID(value)) {
      throw InvalidParameterError.withParameter('entity identifier');
    }

    return new EntityId(value, 'uuid');
  }

  static fromInteger(value: number): EntityId<string> {
    if (!LibUtils.isValidInteger(value)) {
      throw InvalidParameterError.withParameter('entity identifier must be a non-negative integer');
    }

    return new EntityId(value.toString(), 'integer');
  }

  static fromBigInt(value: string | bigint): EntityId<string> {
    const stringValue = LibUtils.normalizeIdToString(value);

    if (!LibUtils.isValidBigInt(stringValue)) {
      throw InvalidParameterError.withParameter('entity identifier must be a valid bigint');
    }

    return new EntityId(stringValue, 'bigint');
  }

  static fromText(value: string): EntityId<string> {
    if (!LibUtils.hasValue(value)) {
      throw MissingValueError.withValue('entity identifier');
    }

    if (!LibUtils.isValidTextId(value)) {
      throw InvalidParameterError.withParameter('entity identifier contains invalid characters');
    }

    return new EntityId(value, 'text');
  }

  // Instance methods implementing IEntityIdFactory
  createWithRandomUUID(): EntityId<string> {
    return EntityIdFactory.createWithRandomUUID();
  }

  fromUUID(value: string): EntityId<string> {
    return EntityIdFactory.fromUUID(value);
  }

  fromInteger(value: number): EntityId<string> {
    return EntityIdFactory.fromInteger(value);
  }

  fromBigInt(value: string | bigint): EntityId<string> {
    return EntityIdFactory.fromBigInt(value);
  }

  fromText(value: string): EntityId<string> {
    return EntityIdFactory.fromText(value);
  }
}
