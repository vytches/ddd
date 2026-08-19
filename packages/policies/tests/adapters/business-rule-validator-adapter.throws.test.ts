import { afterEach, describe, expect, it, vi } from 'vitest';
import { internalLogger } from '@vytches/ddd-contracts/internal';
import { BusinessRuleValidator } from '@vytches/ddd-validation';
import { BusinessRuleValidatorAdapter } from '../../src';

/**
 * AC4 — `BusinessRuleValidatorAdapter.isSatisfiedBy` no longer swallows a
 * throwing validator silently (SA-M4): it logs via `internalLogger.warn`
 * (specification name + sanitized message) and still returns `false`
 * instead of rethrowing — callers composing this via `and()`/`or()`/`not()`
 * must not blow up on one failing leaf.
 *
 * `internalLogger` is a cross-package internal (from
 * '@vytches/ddd-contracts/internal'), not this package's own business
 * logic — spying on it observes a side effect rather than mocking
 * something this package's tests are meant to exercise directly (N4's
 * documented exception).
 *
 * LT1/N1: `BusinessRuleValidatorAdapter` is imported from '../../src' (this
 * package's own public barrel, `packages/policies/src/index.ts` — the same
 * file '@vytches/ddd-policies' resolves to), not an internal subpath —
 * this repo's `@nx/enforce-module-boundaries` lint rule rejects importing a
 * project's own package name from within itself (see the sibling
 * api-surface.test.ts for the same pattern), so a same-project contract
 * test cannot literally spell the package name the way a cross-package one
 * does. The sibling packages ('@vytches/ddd-contracts/internal',
 * '@vytches/ddd-validation') ARE imported by package name, as they must be.
 */
describe('BusinessRuleValidatorAdapter.isSatisfiedBy — validator throws (AC4)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the specification name and a sanitized message via internalLogger.warn, and returns false instead of rethrowing', () => {
    interface Candidate {
      age: number;
    }

    const throwingValidator = BusinessRuleValidator.create<Candidate>().addRule(
      'age',
      () => {
        throw new TypeError('boom: unexpected candidate shape');
      },
      'age must be valid'
    );

    const adapter = new BusinessRuleValidatorAdapter(throwingValidator, 'AgeCheck');
    const warnSpy = vi.spyOn(internalLogger, 'warn').mockImplementation(() => undefined);

    const result = adapter.isSatisfiedBy({ age: 30 });

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    const [message, data] = warnSpy.mock.calls[0]!;
    expect(typeof message).toBe('string');
    expect(data).toMatchObject({ name: 'AgeCheck' });
    // Sanitized: the error's message text is surfaced, not a raw stack
    // trace or the error object itself.
    expect(typeof (data as Record<string, unknown>)['error']).toBe('string');
    expect((data as Record<string, unknown>)['error']).toContain(
      'boom: unexpected candidate shape'
    );
  });

  it('does not rethrow — a specification composed via and() keeps working when one leaf throws', () => {
    interface Candidate {
      age: number;
    }

    const throwingValidator = BusinessRuleValidator.create<Candidate>().addRule(
      'age',
      () => {
        throw new TypeError('boom');
      },
      'age must be valid'
    );

    const adapter = new BusinessRuleValidatorAdapter(throwingValidator, 'ThrowingCheck');
    vi.spyOn(internalLogger, 'warn').mockImplementation(() => undefined);

    expect(() => adapter.isSatisfiedBy({ age: 1 })).not.toThrow();
    expect(adapter.isSatisfiedBy({ age: 1 })).toBe(false);
  });
});
