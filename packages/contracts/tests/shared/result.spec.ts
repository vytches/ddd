import { describe, it, expect } from 'vitest';
import { Result } from '../../src';

/**
 * Smoke tests verifying Result<T, E> is correctly exposed by the contracts
 * package after migration from utils (REL-008 Option B).
 *
 * Full behavior coverage lives in `packages/utils/tests/result.spec.ts` —
 * those tests run against the re-exported Result from utils, which proves
 * the shim works.
 */
describe('contracts/shared/Result — public API surface', () => {
  it('exports Result class', () => {
    expect(Result).toBeDefined();
    expect(typeof Result.ok).toBe('function');
    expect(typeof Result.fail).toBe('function');
    expect(typeof Result.empty).toBe('function');
  });

  it('Result.ok creates a success result', () => {
    const result = Result.ok<number>(42);
    expect(result.isSuccess).toBe(true);
    expect(result.isFailure).toBe(false);
    expect(result.value).toBe(42);
  });

  it('Result.fail creates a failure result', () => {
    const error = new Error('test');
    const result = Result.fail<number, Error>(error);
    expect(result.isFailure).toBe(true);
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBe(error);
  });

  it('Result.empty creates a void success', () => {
    const result = Result.empty<Error>();
    expect(result.isSuccess).toBe(true);
    expect(result.value).toBeUndefined();
  });
});
