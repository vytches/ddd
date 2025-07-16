import { LibUtils } from '@vytches-ddd/utils';
import { InvalidParameterError, MissingValueError } from '@vytches-ddd/domain-primitives';
import {
  EntityId as BaseEntityId,
  type IEntityIdFactory,
  type IdType,
} from '@vytches-ddd/contracts';

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
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new EntityId());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
 * @llm-summary EntityIdFactory class for entity id factory operations
 * @llm-domain Core
 * @llm-complexity Medium
 *
 * @description
 * EntityIdFactory class implementing core domain functionality for entity id factory operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new EntityIdFactory();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new EntityIdFactory());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
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
