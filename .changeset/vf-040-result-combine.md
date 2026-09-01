---
'@vytches/ddd-contracts': minor
---

feat(contracts): add `Result.combine`/`Result.combineWithAllErrors` for
aggregating multiple `Result`s (VF-040)

**`@vytches/ddd-contracts`:**

- `Result.combine(results)` — runs a list of same-error-type `Result`s and
  returns the first failure, or a `Result` holding a **tuple** of their values
  (not `unknown[]`) on success. The tuple shape is inferred from the input via a
  variadic constraint, so `combine([a, b, c])` types its success value as
  `[A, B, C]`, not `unknown[]`.
- `Result.combineWithAllErrors(results)` — same idea, but on failure returns
  **every** failing result's original error object as a `readonly TError[]`,
  never flattened to messages or strings. The position of an entry in that array
  does **not** correspond to its position in the input list — the list is
  compacted to failures only, so an index only tells you "this many results
  failed," not "which one."
- No `combineAsync`: awaiting an array of promises before calling `combine` is a
  one-line alternative, so a dedicated async variant would only duplicate that.
- The helper type used to compute the tuple shape (`UnwrapAll`) stays internal —
  it is not exported from the package's barrel.

**Why this is a `minor`, not a `major`:**

`Result`'s constructor is, and has always been, private — the class is nominal,
not structural. A consumer could never satisfy `Result`'s shape with a plain
object, and `implements Result<...>` was never legal TypeScript for the same
reason. Adding two static methods to an existing nominal class can therefore
never break a caller: nothing outside this package could ever have been relying
on `Result` _not_ having them, because nothing outside this package could
construct a value shaped like `Result` in the first place. `keyof typeof Result`
only ever widens. This is purely additive, matching `BC1`.

**Usage:**

```ts
import { Result } from '@vytches/ddd-contracts';

// stop at the first failure
const combined = Result.combine([
  Email.create(dto.email),
  PersonName.create(dto.name),
  Address.create(dto.address),
]);
if (combined.isFailure) {
  return Result.fail(combined.error);
}
const [email, name, address] = combined.value;

// or collect every failure at once (e.g. form validation)
const withAllErrors = Result.combineWithAllErrors([
  Email.create(dto.email),
  PersonName.create(dto.name),
  Address.create(dto.address),
]);
if (withAllErrors.isFailure) {
  // withAllErrors.error is readonly ValidationError[] — every original
  // error object, compacted (its index does not map back to the input)
  return Result.fail(withAllErrors.error);
}
```
