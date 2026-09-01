import { describe, expectTypeOf, it } from 'vitest';
import { Result } from '@vytches/ddd-contracts';
import { CompensationStack, runCompensated } from '../../src';
import type { CompensationFailure, CompensationOutcome } from '../../src';

/**
 * VF-040 — compile-time type contract for `CompensationStack` /
 * `runCompensated` (LT3 / N2).
 *
 * Same import/style convention as
 * packages/contracts/tests/shared/result-combine.types.test.ts:
 * `expectTypeOf` re-exported by vitest itself, this package's own barrel
 * ('../../src', LT1), `Result` from its own package rather than an internal
 * path of this one, asserted with `expectTypeOf`, never `as any` (N2).
 *
 * Type-level only: checked by `tsc`, not by Vitest's esbuild-backed runtime
 * (which strips types without checking them) — run via the package's
 * type-check script, not just `vitest run`.
 */
describe('CompensationStack.acquire — type contract', () => {
  it('resolves to the value type the acquire function itself produces, not unknown', async () => {
    const stack = CompensationStack.create();
    const acquired = stack.acquire(
      'reserve-inventory',
      () => Promise.resolve({ reservationId: 'r-1' }),
      _reservation => Promise.resolve()
    );
    expectTypeOf(acquired).toEqualTypeOf<Promise<{ reservationId: string }>>();
    expectTypeOf(await acquired).not.toEqualTypeOf<unknown>();
  });

  it('compensate receives exactly the value acquire resolved with', async () => {
    const stack = CompensationStack.create();
    const compensate = (acquired: number): Promise<void> =>
      Promise.resolve(acquired.toFixed(0)).then(() => undefined);
    const acquired = await stack.acquire(
      'reserve-inventory',
      () => Promise.resolve(42),
      compensate
    );
    expectTypeOf(acquired).toEqualTypeOf<number>();
    expectTypeOf(compensate).parameter(0).toEqualTypeOf<number>();
  });
});

describe('CompensationStack.unwind — type contract', () => {
  it('resolves to a readonly CompensationFailure array, not a mutable one', async () => {
    const stack = CompensationStack.create();
    const failures = stack.unwind();
    expectTypeOf(failures).toEqualTypeOf<Promise<readonly CompensationFailure[]>>();
    expectTypeOf(await failures).not.toEqualTypeOf<CompensationFailure[]>();
  });
});

describe('runCompensated — type contract', () => {
  it('the success value type is preserved end to end', () => {
    const stack = CompensationStack.create();
    const outcome = runCompensated(stack, async () => Result.ok<string, Error>('order-placed'));
    expectTypeOf(outcome).toEqualTypeOf<Promise<Result<string, CompensationOutcome<Error>>>>();
  });

  it('the failure shape is unconditional — cause plus compensationFailures, never a bare TError union', () => {
    class OrderError extends Error {
      constructor(public readonly code: string) {
        super(code);
      }
    }
    const stack = CompensationStack.create();
    const outcome = runCompensated(stack, async () =>
      Result.fail<string, OrderError>(new OrderError('E1'))
    );
    expectTypeOf(outcome).toEqualTypeOf<Promise<Result<string, CompensationOutcome<OrderError>>>>();
    expectTypeOf<CompensationOutcome<OrderError>>().toHaveProperty('cause');
    expectTypeOf<CompensationOutcome<OrderError>>().toHaveProperty('compensationFailures');
    // Not a bare union with the original error type — a failed cleanup can
    // never stand in for or hide the real failure (D-11).
    expectTypeOf<CompensationOutcome<OrderError>>().not.toEqualTypeOf<OrderError>();
  });

  it('compensationFailures is readonly CompensationFailure[], never widened to unknown[]', () => {
    expectTypeOf<CompensationOutcome<Error>['compensationFailures']>().toEqualTypeOf<
      readonly CompensationFailure[]
    >();
    expectTypeOf<CompensationOutcome<Error>['compensationFailures']>().not.toEqualTypeOf<
      readonly unknown[]
    >();
  });
});
