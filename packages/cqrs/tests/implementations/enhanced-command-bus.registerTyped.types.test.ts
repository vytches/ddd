import { describe, it, expect } from 'vitest';
import type { EnhancedCommandBus, ICommand, ICommandHandler } from '../../src';

/**
 * VF-025 AC11 — compile-time type fixtures for `registerTyped()` /
 * `registerFactoryTyped()`.
 *
 * `enhanced-command-bus.test.ts`'s "registerTyped / registerFactoryTyped
 * (VF-025 AC11)" block covers the RUNTIME contract (both methods delegate to
 * `register()`/`registerFactory()` — identical dispatch, identical
 * last-write-wins). None of those tests can exercise the actual deliverable
 * of AC11/Q6: `registerTyped<T extends ICommand>()` narrows `commandType`
 * away from `register()`'s `commandType: unknown`, so a `handler` whose
 * generic command parameter doesn't match `commandType` is rejected AT THE
 * CALL SITE, at compile time — before the mismatch could ever reach a test
 * run. A runtime test cannot observe a rejection that never executes; only
 * `tsc` can. This file is that missing half.
 *
 * This repo's established convention for type-level assertions (see
 * `packages/value-objects/tests/base-value-object.identity-components.type-fixtures.test.ts`
 * and `packages/cqrs/tests/implementations/bus-retry-options.types.test.ts`)
 * is inline `// @ts-expect-error` directives checked by the package's
 * `type-check` target (`tsc --noEmit`, which includes the whole `tests`
 * directory per `packages/cqrs/tsconfig.json`), not a separate
 * expect-type/tsd harness.
 * This file follows that convention.
 *
 * `CommandA`/`CommandB` carry a distinguishing literal-typed `kind` field
 * on purpose: `ICommandHandler.execute` is a method-shorthand member, which
 * TypeScript checks bivariantly regardless of `strictFunctionTypes` — two
 * *empty* command classes are structurally identical (`{}`), so a handler
 * for one would silently satisfy the other and this fixture would compile
 * clean either way, proving nothing. The `kind` literal makes `CommandA`
 * and `CommandB` structurally incompatible in both directions, so the
 * mismatch below is guaranteed to surface as a real diagnostic.
 *
 * The call-site fixtures live inside `typeFixtures()`, which is declared
 * but never invoked: `tsc` still fully type-checks its body (type-checking
 * doesn't care whether a function is ever called), but nothing inside it
 * executes when vitest imports and runs this file — unlike a bare
 * `declare const bus: EnhancedCommandBus` used at module scope, which
 * erases to nothing at the declaration site but leaves every `bus.foo()`
 * call below it referencing an undefined `bus` at runtime.
 */

class CommandA implements ICommand {
  readonly kind = 'A' as const;
}

class CommandB implements ICommand {
  readonly kind = 'B' as const;
}

class HandlerA implements ICommandHandler<CommandA> {
  async execute(_command: CommandA): Promise<void> {
    // fixture only
  }
}

class HandlerB implements ICommandHandler<CommandB> {
  async execute(_command: CommandB): Promise<void> {
    // fixture only
  }
}

// Never called — see file header. `tsc` type-checks this body regardless.
function typeFixtures(bus: EnhancedCommandBus): void {
  // -------------------------------------------------------------------------
  // Positive fixture — matching command/handler pair compiles cleanly on
  // both the typed methods and the plain (unknown-typed) ones.
  // -------------------------------------------------------------------------

  bus.registerTyped(CommandA, new HandlerA());
  bus.registerFactoryTyped(CommandA, () => new HandlerA());
  bus.register(CommandA, new HandlerA());
  bus.registerFactory(CommandA, () => new HandlerA());

  // -------------------------------------------------------------------------
  // Negative fixture 1 — registerTyped() rejects a handler for the WRONG
  // command class. This is the exact defect registerTyped() exists to catch
  // at compile time (Q6/AC11), which register()'s `commandType: unknown`
  // cannot.
  // -------------------------------------------------------------------------

  // @ts-expect-error TS2345 — HandlerB's `execute(command: CommandB)` is not
  // assignable to the `ICommandHandler<CommandA>` this call site requires.
  bus.registerTyped(CommandA, new HandlerB());

  // -------------------------------------------------------------------------
  // Negative fixture 2 — same mismatch via registerFactoryTyped().
  // -------------------------------------------------------------------------

  // @ts-expect-error TS2322 — same mismatch as above, through the factory
  // overload (surfaces as a return-type error on the factory closure rather
  // than an argument error, since the mismatch is inside `() => new
  // HandlerB()`'s inferred return type).
  bus.registerFactoryTyped(CommandA, () => new HandlerB());

  // -------------------------------------------------------------------------
  // Contrast fixture — the untyped variants accept the identical mismatched
  // pair without complaint, because `commandType: unknown` gives the
  // compiler nothing to check `handler` against. This is the precise gap
  // `registerTyped` closes, documented as a passing (non-`@ts-expect-error`)
  // call so a future narrowing of `register()`/`registerFactory()` that
  // starts rejecting this too is a visible, deliberate change here — not a
  // silent one.
  // -------------------------------------------------------------------------

  bus.register(CommandA, new HandlerB());
  bus.registerFactory(CommandA, () => new HandlerB());
}
void typeFixtures;

describe('EnhancedCommandBus registerTyped()/registerFactoryTyped() type fixtures (VF-025 AC11)', () => {
  it('is a type-only fixture file; this assertion exists only so the suite is non-empty', () => {
    expect(typeof HandlerA).toBe('function');
  });
});
