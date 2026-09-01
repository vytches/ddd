import { describe, it, expect } from 'vitest';
import { Result } from '../../src';

/**
 * VF-040 — behavior tests for `Result.combine` and
 * `Result.combineWithAllErrors`.
 *
 * Imports from the package's own public barrel via '../../src' (same
 * pattern as result.test.ts in this directory), never a relative path into
 * src/shared/ directly — see LT1.
 */

/**
 * A domain-shaped error carrying an extra field, used to prove that
 * `combineWithAllErrors` hands back the exact original error objects
 * (reference identity), not copies or flattened messages. If a future
 * change ever collapsed the error array to strings, `field` would no
 * longer be reachable on the elements and this test would fail to compile
 * or fail at runtime.
 */
class FieldError extends Error {
  constructor(
    message: string,
    public readonly field: string
  ) {
    super(message);
    this.name = 'FieldError';
  }
}

describe('Result.combine', () => {
  it('an empty input list succeeds with an empty tuple', () => {
    const combined = Result.combine([]);
    expect(combined.isSuccess).toBe(true);
    expect(combined.value).toEqual([]);
  });

  it('all successes produce a success whose value is a tuple in input order', () => {
    const combined = Result.combine([
      Result.ok<number>(1),
      Result.ok<string>('two'),
      Result.ok<boolean>(true),
    ]);
    expect(combined.isSuccess).toBe(true);
    expect(combined.value).toEqual([1, 'two', true]);
  });

  it('a single failure produces a failure carrying that error', () => {
    const error = new Error('invalid email');
    const combined = Result.combine([Result.ok<number>(1), Result.fail<string, Error>(error)]);
    expect(combined.isFailure).toBe(true);
    expect(combined.error).toBe(error);
  });

  it('multiple failures produce a failure carrying only the FIRST error, not the last', () => {
    const firstError = new Error('first failure');
    const secondError = new Error('second failure');
    const combined = Result.combine([
      Result.ok<number>(1),
      Result.fail<string, Error>(firstError),
      Result.fail<boolean, Error>(secondError),
    ]);
    expect(combined.isFailure).toBe(true);
    expect(combined.error).toBe(firstError);
    expect(combined.error).not.toBe(secondError);
  });
});

describe('Result.combineWithAllErrors', () => {
  it('an empty input list succeeds with an empty tuple', () => {
    const combined = Result.combineWithAllErrors([]);
    expect(combined.isSuccess).toBe(true);
    expect(combined.value).toEqual([]);
  });

  it('all successes produce a success whose value is a tuple in input order', () => {
    const combined = Result.combineWithAllErrors([Result.ok<number>(1), Result.ok<string>('two')]);
    expect(combined.isSuccess).toBe(true);
    expect(combined.value).toEqual([1, 'two']);
  });

  it('collects every original error by reference, in input order (not just messages)', () => {
    const emailError = new FieldError('must contain @', 'email');
    const nameError = new FieldError('must not be empty', 'name');
    const combined = Result.combineWithAllErrors([
      Result.fail<string, FieldError>(emailError),
      Result.ok<string>('unused'),
      Result.fail<string, FieldError>(nameError),
    ]);

    expect(combined.isFailure).toBe(true);
    // Reference identity, not just deep/message equality — a future change
    // that flattened errors to strings would break this assertion.
    expect(combined.error[0]).toBe(emailError);
    expect(combined.error[1]).toBe(nameError);
    // The extra field survives round-trip because the original object,
    // not a copy, comes back.
    expect(combined.error[0]?.field).toBe('email');
    expect(combined.error[1]?.field).toBe('name');
  });

  it('compacts the error array: mixed successes/failures yield only the failures, sized to failure count', () => {
    const errorA = new FieldError('bad', 'a');
    const errorC = new FieldError('bad', 'c');
    const combined = Result.combineWithAllErrors([
      Result.fail<string, FieldError>(errorA),
      Result.ok<string>('b-ok'),
      Result.fail<string, FieldError>(errorC),
      Result.ok<string>('d-ok'),
    ]);

    expect(combined.isFailure).toBe(true);
    // 2 failures out of 4 inputs — the error array has length 2, not 4,
    // and holds no gaps/undefined for the successful positions.
    expect(combined.error).toHaveLength(2);
    expect(combined.error).toEqual([errorA, errorC]);
  });
});
