import { describe, expectTypeOf, it } from 'vitest';
import { Result } from '../../src';

/**
 * VF-040 — compile-time type contract for `Result.combine` and
 * `Result.combineWithAllErrors` (LT3 / N2).
 *
 * `Result.combine`/`combineWithAllErrors` infer a tuple type from the input
 * array's literal element types (see the `UnwrapAll` helper in
 * src/shared/result.ts). This file pins that the returned `.value` is a
 * concrete, positionally-typed tuple — never widened to `unknown[]` — and
 * asserted with `expectTypeOf`, never `as any` (N2).
 *
 * Same import/style convention as the existing type-fixture tests in this
 * repo (see packages/cqrs/tests/implementations/bus-retry-options.types.test.ts
 * and packages/nestjs/tests/async-config.types.test.ts): `expectTypeOf`
 * re-exported by vitest itself, package imported from its own public
 * barrel ('../../src'), consistent with LT1.
 *
 * Type-level only: these assertions are checked by `tsc`, not by Vitest's
 * esbuild-backed runtime (which strips types without checking them) — run
 * via the package's type-check script, not just `vitest run`.
 */
describe('Result.combine — type contract', () => {
  it('infers a positionally-typed tuple, not unknown[]', () => {
    const combined = Result.combine([
      Result.ok<number>(1),
      Result.ok<string>('a'),
      Result.ok<boolean>(true),
    ]);
    expectTypeOf(combined).toEqualTypeOf<Result<[number, string, boolean], Error>>();
    expectTypeOf(combined.value).toEqualTypeOf<[number, string, boolean]>();
    expectTypeOf(combined.value).not.toEqualTypeOf<unknown[]>();
  });

  it('an empty input array types as an empty tuple', () => {
    const combined = Result.combine([]);
    expectTypeOf(combined.value).toEqualTypeOf<[]>();
  });

  it('the error type is the shared TError, not unknown', () => {
    class DomainError extends Error {
      constructor(public readonly code: string) {
        super(code);
      }
    }
    const combined = Result.combine([
      Result.ok<number, DomainError>(1),
      Result.fail<string, DomainError>(new DomainError('E1')),
    ]);
    expectTypeOf(combined).toEqualTypeOf<Result<[number, string], DomainError>>();
  });
});

describe('Result.combineWithAllErrors — type contract', () => {
  it('infers the same positionally-typed value tuple as combine', () => {
    const combined = Result.combineWithAllErrors([Result.ok<number>(1), Result.ok<string>('a')]);
    expectTypeOf(combined.value).toEqualTypeOf<[number, string]>();
    expectTypeOf(combined.value).not.toEqualTypeOf<unknown[]>();
  });

  it('the error type is a readonly array of the original TError, not string[]', () => {
    class DomainError extends Error {
      constructor(public readonly code: string) {
        super(code);
      }
    }
    const combined = Result.combineWithAllErrors([
      Result.ok<number, DomainError>(1),
      Result.fail<string, DomainError>(new DomainError('E1')),
    ]);
    expectTypeOf(combined).toEqualTypeOf<Result<[number, string], readonly DomainError[]>>();
    expectTypeOf(combined.error).not.toEqualTypeOf<string[]>();
  });
});
