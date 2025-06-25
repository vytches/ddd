/* eslint-disable no-promise-executor-return */
import { v4 as uuidV4, validate } from 'uuid';

type UUID = 'v4';

export class LibUtils {
  static getUUID(type?: UUID) {
    if (type === 'v4') {
      return uuidV4();
    }

    return uuidV4();
  }

  private static _isSpecialCaseFalse(input: unknown): boolean {
    if (
      input === Object.create(null) ||
      typeof input === 'function' ||
      typeof input === 'symbol'
    ) {
      return true;
    }

    if (
      input !== null &&
      typeof input === 'object' &&
      !Array.isArray(input) &&
      !(input instanceof Date) &&
      !(input instanceof Map) &&
      !(input instanceof Set) &&
      Object.keys(input).length === 0 &&
      Object.getOwnPropertyNames(input).length > 0
    ) {
      return true;
    }

    return false;
  }

  private static _isExtremeLargeNumber(input: unknown): boolean {
    return (
      input === Number.MAX_SAFE_INTEGER ||
      input === Number.MIN_SAFE_INTEGER ||
      input === Infinity ||
      input === -Infinity
    );
  }

  private static _isNonEmptyCollection(input: unknown): boolean {
    return (
      (input instanceof Map || input instanceof Set) &&
      (input as Map<unknown, unknown> | Set<unknown>).size > 0
    );
  }

  private static _isTruthy(input: unknown): boolean {
    if (input === null || input === undefined) {
      return false;
    }

    if (typeof input === 'boolean') {
      return input;
    }

    if (typeof input === 'number') {
      return input !== 0 && !Number.isNaN(input);
    }

    if (typeof input === 'string') {
      return input.length > 0;
    }

    if (typeof input === 'bigint') {
      return input !== BigInt(0);
    }

    if (input instanceof Map || input instanceof Set) {
      return input.size > 0;
    }

    if (typeof input === 'object') {
      if (Array.isArray(input)) {
        return input.length > 0;
      }

      if (input instanceof Date) {
        return !Number.isNaN(input.getTime());
      }

      return Object.keys(input).length > 0;
    }

    return false;
  }

  static isEmpty(input: unknown): boolean {
    if (this._isExtremeLargeNumber(input)) {
      return false;
    }

    if (this._isNonEmptyCollection(input)) {
      return false;
    }

    if (this._isSpecialCaseFalse(input)) {
      return true;
    }

    return !this._isTruthy(input);
  }

  static hasValue(input: unknown): boolean {
    if (this._isExtremeLargeNumber(input)) {
      return true;
    }

    if (this._isNonEmptyCollection(input)) {
      return true;
    }

    if (this._isSpecialCaseFalse(input)) {
      return false;
    }

    return this._isTruthy(input);
  }

  static isNotEmpty(input: unknown): boolean {
    if (this._isExtremeLargeNumber(input)) {
      return true;
    }

    if (this._isNonEmptyCollection(input)) {
      return true;
    }

    if (this._isSpecialCaseFalse(input)) {
      return false;
    }

    return this._isTruthy(input);
  }

  static isTruthy(input: unknown): boolean {
    if (this._isExtremeLargeNumber(input)) {
      return true;
    }

    if (this._isNonEmptyCollection(input)) {
      return true;
    }

    if (this._isSpecialCaseFalse(input)) {
      return false;
    }

    return this._isTruthy(input);
  }

  static isFalsy(input: unknown): boolean {
    if (this._isExtremeLargeNumber(input)) {
      return false;
    }

    if (this._isNonEmptyCollection(input)) {
      return false;
    }

    if (this._isSpecialCaseFalse(input)) {
      return true;
    }

    return !this._isTruthy(input);
  }

  static async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static isValidUUID(value: string): boolean {
    return validate(value);
  }

  static isValidInteger(value: number): boolean {
    return Number.isInteger(value) && value >= 0;
  }

  static isValidBigInt(value: string): boolean {
    if (!value.match(/^\d+$/)) {
      return false;
    }

    try {
      BigInt(value);
      return true;
    } catch {
      return false;
    }
  }

  static isValidTextId(value: string): boolean {
    return Boolean(value.match(/^[a-zA-Z0-9_-]+$/));
  }

  static normalizeIdToString(value: string | number | bigint): string {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    return value;
  }

  static deepEqual(
    obj1: unknown,
    obj2: unknown,
    visitedPairs = new WeakMap(),
  ): boolean {
    if (Object.is(obj1, obj2) || obj1 === obj2) {
      return true;
    }

    if (
      typeof obj1 !== 'object' ||
      typeof obj2 !== 'object' ||
      obj1 === null ||
      obj2 === null
    ) {
      return false;
    }

    if (visitedPairs.has(obj1 as object)) {
      return visitedPairs.get(obj1 as object) === obj2;
    }

    visitedPairs.set(obj1 as object, obj2);

    const keys1 = Object.keys(obj1 as object);
    const keys2 = Object.keys(obj2 as object);

    if (keys1.length !== keys2.length) {
      return false;
    }

    for (const key of keys1) {
      if (!keys2.includes(key)) {
        return false;
      }

      const val1 = (obj1 as Record<string, unknown>)[key];
      const val2 = (obj2 as Record<string, unknown>)[key];

      if (!this.deepEqual(val1, val2, visitedPairs)) {
        return false;
      }
    }

    return true;
  }
}
