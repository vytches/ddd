import { LibUtils } from '@vytches-ddd/utils';

import { InvalidParameterError, MissingValueError } from '../errors';
import { BaseValueObject } from './base-value-object';

export type IdType = 'uuid' | 'integer' | 'text' | 'bigint';

export class EntityId<T = string> extends BaseValueObject<T> {
  private readonly type: IdType;

  constructor(
    override readonly value: T,
    type: IdType,
  ) {
    super(value);
    this.type = type;
  }

  validate(value: T): boolean {
    switch (this.type) {
      case 'uuid':
        return LibUtils.isValidUUID(value as unknown as string);
      case 'integer':
        return LibUtils.isValidInteger(value as unknown as number);
      case 'bigint':
        return LibUtils.isValidBigInt(value as unknown as string);
      case 'text':
        return LibUtils.isValidTextId(value as unknown as string);
      default:
        throw new InvalidParameterError(`Unsupported IdType: ${this.type}`);
    }
  }

  static createWithRandomUUID(): EntityId {
    return new EntityId(LibUtils.getUUID(), 'uuid');
  }

  static fromUUID(value: string): EntityId {
    if (!LibUtils.hasValue(value)) {
      throw MissingValueError.withValue('entity identifier');
    }

    if (!LibUtils.isValidUUID(value)) {
      throw InvalidParameterError.withParameter('entity identifier');
    }

    return new EntityId(value, 'uuid');
  }

  static fromInteger(value: number): EntityId {
    if (!LibUtils.isValidInteger(value)) {
      throw InvalidParameterError.withParameter(
        'entity identifier must be a non-negative integer',
      );
    }

    return new EntityId(value.toString(), 'integer');
  }

  static fromBigInt(value: string | bigint): EntityId {
    const stringValue = LibUtils.normalizeIdToString(value);

    if (!LibUtils.isValidBigInt(stringValue)) {
      throw InvalidParameterError.withParameter(
        'entity identifier must be a valid bigint',
      );
    }

    return new EntityId(stringValue, 'bigint');
  }

  static fromText(value: string): EntityId {
    if (!LibUtils.hasValue(value)) {
      throw MissingValueError.withValue('entity identifier');
    }

    if (!LibUtils.isValidTextId(value)) {
      throw InvalidParameterError.withParameter(
        'entity identifier contains invalid characters',
      );
    }

    return new EntityId(value, 'text');
  }

  override equals(entityId: EntityId<T>): boolean {
    return (
      entityId.getValue() === this.value && entityId.getType() === this.type
    );
  }

  getType(): IdType {
    return this.type;
  }

  override toJSON() {
    return JSON.stringify({
      value: this.value,
      type: this.type,
    });
  }

  isType(type: IdType): boolean {
    return this.type === type;
  }
}
