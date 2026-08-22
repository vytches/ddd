import { describe, expectTypeOf, it } from 'vitest';
import type { BusRetryOptions } from '../../src';

/**
 * D12 — compile-time type fixture for `BusRetryOptions`.
 *
 * Imports from the package's own public barrel via '../../src'
 * (`packages/cqrs/src/index.ts`) — the exact file the package name
 * '@vytches/ddd-cqrs' resolves to (see tsconfig.base.json's path mapping
 * and vitest.config.mts's alias). This is precisely what the prerequisite
 * fix (adding `export type { BusRetryOptions } from
 * './implementations/bus-retry-options'` to that index.ts) makes possible:
 * before that fix, this import would fail to resolve, because
 * `BusRetryOptions` was only reachable via the internal `./implementations`
 * barrel, not the package's public entry point.
 *
 * LT1/N1 note: a literal `from '@vytches/ddd-cqrs'` here (rather than
 * '../../src') is rejected by this repo's `@nx/enforce-module-boundaries`
 * lint rule, which forbids a project importing its own package name from
 * within itself — see tests/api-surface.test.ts and
 * tests/symbol-tokens.test.ts for the same established repo pattern on this
 * exact package. '../../src' is the closest available match to LT1's
 * intent ("public entry point, never an internal subpath") that also
 * passes this repo's own lint gate.
 *
 * Uses `expectTypeOf` (re-exported by `vitest` from the `expect-type`
 * package, which is already a transitive devDependency via vitest itself —
 * see packages/value-objects's type-fixtures test for this repo's
 * `@ts-expect-error`/`tsc --noEmit` convention; no package in this repo
 * currently maintains a separate expect-type/tsd harness, so `expectTypeOf`
 * imported straight from `vitest` is the closest fit to both that
 * convention and the LT3 requirement for compile-time type assertions
 * (never `as any`).
 */
describe('@vytches/ddd-cqrs BusRetryOptions (type contract, D12)', () => {
  it('declares every field optional', () => {
    expectTypeOf<BusRetryOptions>().toEqualTypeOf<{
      enabled?: boolean;
      maxAttempts?: number;
      baseDelay?: number;
      maxDelay?: number;
      backoffMultiplier?: number;
      jitter?: boolean;
    }>();

    // Load-bearing compile-time fixture (this repo's established
    // `@ts-expect-error`/assignment-fixture convention — see
    // packages/value-objects's type-fixtures test): an empty object literal
    // must be assignable to `BusRetryOptions`. If any field lost its `?`,
    // this line stops compiling and `tsc --noEmit` catches it, independent
    // of the `toEqualTypeOf` assertion above. `void` keeps it from looking
    // like a dead unused variable to lint.
    const empty: BusRetryOptions = {};
    void empty;
  });

  it('individual fields have the documented primitive types', () => {
    expectTypeOf<BusRetryOptions['enabled']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<BusRetryOptions['maxAttempts']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<BusRetryOptions['baseDelay']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<BusRetryOptions['maxDelay']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<BusRetryOptions['backoffMultiplier']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<BusRetryOptions['jitter']>().toEqualTypeOf<boolean | undefined>();
  });
});
