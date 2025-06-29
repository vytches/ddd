import { it, expect, describe } from 'vitest';
import { LibUtils, safeRun } from '@vytches-ddd/utils';

import { InvalidParameterError, MissingValueError } from '../errors';
import { EntityId } from './id.value-object';

describe('EntityId', () => {
  it('should create a valid UUID EntityId', () => {
    const entityId = EntityId.createWithRandomUUID();

    expect(LibUtils.isValidUUID(entityId.value)).toBe(true);
    expect(entityId.getType()).toBe('uuid');
  });

  it('should create a valid EntityId from UUID', () => {
    const uuid = LibUtils.getUUID();
    const entityId = EntityId.fromUUID(uuid);

    expect(entityId.value).toBe(uuid);
    expect(entityId.getType()).toBe('uuid');
  });

  it('should throw error if UUID is invalid', () => {
    const [error] = safeRun(() => EntityId.fromUUID('invalid-uuid'));

    expect(error).toBeDefined();
    expect(error).instanceOf(InvalidParameterError);
  });

  it('should create a valid EntityId from integer', () => {
    const entityId = EntityId.fromInteger(123);

    expect(entityId.value).toBe('123');
    expect(entityId.getType()).toBe('integer');
  });

  it('should throw error if integer is invalid', () => {
    const [error] = safeRun(() => EntityId.fromInteger(-1));

    expect(error).toBeDefined();
    expect(error?.message).toEqual(
      InvalidParameterError.withParameter('entity identifier must be a non-negative integer')
        .message
    );
  });

  it('should create a valid EntityId from bigint', () => {
    const bigintValue = BigInt('12345678901234567890');
    const entityId = EntityId.fromBigInt(bigintValue);

    expect(entityId.value).toBe(bigintValue.toString());
    expect(entityId.getType()).toBe('bigint');
  });

  it('should throw error if bigint is invalid', () => {
    const [error] = safeRun(() => EntityId.fromBigInt('invalid-bigint'));

    expect(error).toBeInstanceOf(InvalidParameterError);
    expect(error).toEqual(
      InvalidParameterError.withParameter('entity identifier must be a valid bigint')
    );
  });

  it('should create a valid EntityId from text', () => {
    const entityId = EntityId.fromText('validTextId');

    expect(entityId.value).toBe('validTextId');
    expect(entityId.getType()).toBe('text');
  });

  it('should throw error if text ID is invalid', () => {
    const [error] = safeRun(() => EntityId.fromText(''));

    expect(error).toBeDefined();
    expect(error).instanceOf(MissingValueError);
  });

  it('should check equality of two EntityId instances', () => {
    const id1 = EntityId.createWithRandomUUID();
    const id2 = EntityId.fromUUID(id1.value);

    expect(id1.equals(id2)).toBe(true);
  });

  it('should return false for non-equal EntityId instances', () => {
    const id1 = EntityId.createWithRandomUUID();
    const id2 = EntityId.createWithRandomUUID();

    expect(id1.equals(id2)).toBe(false);
  });

  it('should check if EntityId is of a specific type', () => {
    const entityId = EntityId.fromText('validTextId');

    expect(entityId.isType('text')).toBe(true);
    expect(entityId.isType('uuid')).toBe(false);
  });

  it('should return JSON representation of EntityId', () => {
    const entityId = EntityId.fromText('validTextId');
    const json = entityId.toJSON();

    expect(json).toEqual(JSON.stringify({ value: 'validTextId', type: 'text' }));
  });
});
