import { describe, it, expect } from 'vitest';

import { BaseValueObject } from '../src/base-value-object';

/**
 * VF-036: type-level fixtures for `getIdentityComponents()`.
 *
 * This repo's established convention for type-level assertions (see
 * `packages/utils/tests/lib-utils.test.ts` and
 * `packages/events/tests/event-handler.test.ts`) is inline
 * `// @ts-expect-error` directives checked by the package's `type-check`
 * target (`tsc --noEmit`), not a separate expect-type/tsd harness. This file
 * follows that convention.
 *
 * Positive fixture: an override matching the documented signature —
 * `protected getIdentityComponents(): readonly unknown[] | undefined` —
 * must typecheck cleanly.
 *
 * Negative fixtures: each pins one class of override mistake to an exact
 * TypeScript diagnostic code. If a future refactor of `BaseValueObject`
 * changes shape such that a mistake stops being an error (or starts
 * producing a different code), `tsc --noEmit` fails here — either because
 * the `@ts-expect-error` is now unused, or because the class body itself no
 * longer compiles for an unrelated reason — surfacing the drift instead of
 * silently losing the guard.
 *
 * None of the classes below are ever instantiated: they exist purely for
 * `tsc` to type-check. `void` references keep them from looking dead to
 * readers (and to any future lint rule) without affecting behavior.
 */

// ---------------------------------------------------------------------------
// Positive fixture — must compile with zero diagnostics.
// ---------------------------------------------------------------------------

class ValidOverride extends BaseValueObject<string> {
  validate(value: unknown): boolean {
    return typeof value === 'string';
  }

  protected override getIdentityComponents(): readonly unknown[] | undefined {
    return [this.getValue()];
  }
}

// ---------------------------------------------------------------------------
// Negative fixture 1 — TS2425: arrow-function property form.
//
// `BaseValueObject` declares `getIdentityComponents` as an instance METHOD.
// A subclass may override it as an arrow-function *property* without error
// (TypeScript accepts a property-typed-as-a-function overriding a method),
// but that subclass itself now defines the member as a property. A further
// subclass overriding it back as a method conflicts with that intermediate
// property form — this is the shape the "arrow-property form" mistake takes
// in practice (e.g. two people independently "fixing" `this` binding on the
// same hierarchy).
// ---------------------------------------------------------------------------

class ArrowPropertyOverride extends BaseValueObject<string> {
  validate(value: unknown): boolean {
    return typeof value === 'string';
  }

  protected override getIdentityComponents = (): readonly unknown[] | undefined => {
    return [this.getValue()];
  };
}

class MethodOverOverriddenArrowProperty extends ArrowPropertyOverride {
  // @ts-expect-error TS2425 — base class ArrowPropertyOverride defines
  // getIdentityComponents as an (arrow-function) instance property; this
  // class defines it as an instance member function, which conflicts.
  protected override getIdentityComponents(): readonly unknown[] | undefined {
    return [this.getValue()];
  }
}

// ---------------------------------------------------------------------------
// Negative fixture 2 — TS2415: narrowing visibility to `private`.
//
// `BaseValueObject` declares the hook `protected`. Narrowing it to `private`
// in a subclass breaks the base class's contract (a further subclass could
// no longer see or override the member at all), so TypeScript rejects it.
// ---------------------------------------------------------------------------

// @ts-expect-error TS2415 — the class heritage clause is where TypeScript
// anchors this diagnostic (not the member declaration below): narrowing the
// base class's `protected` member to `private` is not a valid override.
class PrivateNarrowingOverride extends BaseValueObject<string> {
  validate(value: unknown): boolean {
    return typeof value === 'string';
  }

  // The actual mistake lives here: `private` narrows a `protected` base
  // member. `override` is still required (noImplicitOverride) independent
  // of the visibility mistake being pinned above.
  private override getIdentityComponents(): readonly unknown[] | undefined {
    return [this.getValue()];
  }
}

// ---------------------------------------------------------------------------
// Negative fixture 3 — TS2416: non-array return type.
//
// The hook must return `readonly unknown[] | undefined`. Returning a bare
// `string` (a common mistake: "the identity is just this one string") is not
// assignable to that return type.
// ---------------------------------------------------------------------------

class NonArrayReturnOverride extends BaseValueObject<string> {
  validate(value: unknown): boolean {
    return typeof value === 'string';
  }

  // @ts-expect-error TS2416 — return type `string` is not assignable to the
  // base signature's `readonly unknown[] | undefined`.
  protected override getIdentityComponents(): string {
    return this.getValue();
  }
}

void ValidOverride;
void ArrowPropertyOverride;
void MethodOverOverriddenArrowProperty;
void PrivateNarrowingOverride;
void NonArrayReturnOverride;

describe('BaseValueObject — getIdentityComponents() type fixtures (VF-036)', () => {
  it('is a type-only fixture file; this assertion exists only so the suite is non-empty', () => {
    expect(typeof ValidOverride).toBe('function');
  });
});
