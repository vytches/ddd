---
name: vf040-verdict
description:
  VF-040 (Result.combine + CompensationStack) final gate — NO-GO pass 1 (generic
  inference), GO pass 2 with warnings about ExtractError's never/placeholder
  semantics
metadata:
  type: project
---

**Pass 1 = NO-GO.**
`static combine<TResults extends readonly Result<unknown, TError>[], TError = Error>`
declared `TError` only inside another parameter's _constraint_, so it was never
inferred and silently fell back to `= Error`. Caught by `type-check` alone: the
`test` target passes regardless because `expectTypeOf` compiles to a runtime
no-op.

**Pass 2 = GO.** Fixed by deriving the error type from the already-inferred
tuple via internal `ExtractError<TResults>` (+ `IsExactlyError`,
`NonPlaceholderError`, `HasCommonSupertype*`). All 7 gates green; helpers stay
unexported and are emitted as local declarations in `dist/shared/result.d.ts`,
so no broken `.d.ts`.

Three behaviours worth remembering, all verified by an isolated tsc probe:

- `Result<T, Error>` elements are treated as placeholders and dropped, so mixing
  a genuine bare-`Error` result with a `DomainError` one types as `DomainError`
  — statically unsound in that narrow case.
- **Sibling subclasses of a shared base** (`ValidationError` + `NotFoundError`,
  both extending `DomainError`) resolve to `never`, not to `DomainError` —
  `HasCommonSupertype` only accepts a dominating type that is itself a _member_
  of the union.
- `never` is the bottom type, so it is silently assignable everywhere:
  `const e: AnyError = combined.error` and `return Result.fail(combined.error)`
  both compile. The "never is a compile-time signal" claim only holds for
  property reads, not propagation.

**How to apply:** when reviewing follow-ups to `Result.combine`, re-check these
three cases first — they are where the type machinery is loosest. See
[[vf040-config-packages-json]].

**Pass 3 (narrow) = GO.** `runCompensated` originally let a _thrown_ `fn` bypass
`unwind()` entirely, leaking acquired resources — the exact defect found in real
consumer code (wallet charged, service never delivered, nothing in the logs).
Fixed with
`try { outcome = await fn(stack) } catch (error) { await stack.unwind(); throw error }`.
The rethrow is safe because `runUnwind` is _total_: its try/catch is inside the
loop and it always resolves to a failures array, so an `await unwind()` in a
catch block can never reject and replace the in-flight error.
