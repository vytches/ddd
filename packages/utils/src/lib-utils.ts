/* eslint-disable no-promise-executor-return */

type UUID = 'v4';

/**
 * RFC 4122/9562 UUID matcher (versions 1-8, plus the nil and max UUIDs).
 * Mirrors the validation semantics of the `uuid` npm package's `validate()`
 * (v10+, e.g. the `regex.js` shipped in `uuid@11.1.0`) without the runtime
 * dependency — case-insensitive, and deliberately NOT restricted to 1-5:
 * the `uuid` package widened the version nibble to 1-8 and added the max
 * UUID special case in v10.0.0 to support the newer RFC 9562 UUID versions
 * (v6/v7/v8); narrowing this back to 1-5 would be a silent behavior
 * regression for any consumer validating those UUIDs.
 */
const UUID_PATTERN =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;

export class LibUtils {
  /**
   * Generate a UUID v4 using the platform crypto API.
   *
   * `globalThis.crypto.randomUUID()` is available in:
   *   - Node.js >= 19 (standard, no import required)
   *   - All modern browsers (Web Crypto)
   *   - Cloudflare Workers / Deno / Bun
   *
   * The library's `engines.node >= 22.19.0` ensures availability.
   * Using globalThis avoids importing `node:crypto`, which Vite externalizes
   * for browser-compat builds and breaks the utils foundation bundle.
   *
   * F-M7 (VB-002): this replaces the vendored `uuid` npm package, which was
   * bundled inline into `utils`'s dist without a license attribution, a
   * devDependency entry, or a security-patch path — see
   * `contracts/src/events/domain-event-utils.ts` for the identical pattern
   * used elsewhere in this monorepo.
   */
  static getUUID(type?: UUID) {
    if (type === 'v4') {
      return globalThis.crypto.randomUUID();
    }

    return globalThis.crypto.randomUUID();
  }

  private static _isSpecialCaseFalse(input: unknown): boolean {
    if (
      typeof input === 'function' ||
      typeof input === 'symbol' ||
      (input !== null && input !== undefined && Object.getPrototypeOf(input) === null)
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

  /** @deprecated Use hasValue() instead — identical behavior */
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

  /** @deprecated Use hasValue() instead — identical behavior */
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

  /** @deprecated Use isEmpty() instead — identical behavior */
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
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static isValidUUID(value: string): boolean {
    return UUID_PATTERN.test(value);
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

  static deepEqual(obj1: unknown, obj2: unknown, visitedPairs = new WeakMap()): boolean {
    if (Object.is(obj1, obj2) || obj1 === obj2) {
      return true;
    }

    if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 === null || obj2 === null) {
      return false;
    }

    if (visitedPairs.has(obj1 as object)) {
      return visitedPairs.get(obj1 as object) === obj2;
    }

    visitedPairs.set(obj1 as object, obj2);

    // Handle built-in types with value semantics
    if (obj1 instanceof Date && obj2 instanceof Date) {
      return obj1.getTime() === obj2.getTime();
    }
    if (obj1 instanceof RegExp && obj2 instanceof RegExp) {
      return obj1.toString() === obj2.toString();
    }
    if (obj1 instanceof Map && obj2 instanceof Map) {
      if (obj1.size !== obj2.size) return false;
      for (const [key, val] of obj1) {
        if (!obj2.has(key) || !this.deepEqual(val, obj2.get(key), visitedPairs)) {
          return false;
        }
      }
      return true;
    }
    if (obj1 instanceof Set && obj2 instanceof Set) {
      if (obj1.size !== obj2.size) return false;
      for (const val of obj1) {
        if (!obj2.has(val)) return false;
      }
      return true;
    }

    // One is a built-in type, other is not
    if (
      (obj1 instanceof Date ||
        obj1 instanceof RegExp ||
        obj1 instanceof Map ||
        obj1 instanceof Set) !==
      (obj2 instanceof Date || obj2 instanceof RegExp || obj2 instanceof Map || obj2 instanceof Set)
    ) {
      return false;
    }

    const keys1 = Object.keys(obj1 as object);
    const keys2 = Object.keys(obj2 as object);

    if (keys1.length !== keys2.length) {
      return false;
    }

    const keys2Set = new Set(keys2);

    for (const key of keys1) {
      if (!keys2Set.has(key)) {
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
