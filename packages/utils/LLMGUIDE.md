# @vytches/ddd-utils - LLM Guide

## Purpose

Generic helpers used across the library: a `Result<T, E>` re-export shim
(canonical home is `@vytches/ddd-contracts` since v0.25.0), grab-bag utility
methods (`LibUtils`), `safeRun` for error-as-value async/sync execution, and a
minimal middleware pipeline for buses.

Most consumers will not import this package directly — `@vytches/ddd` (the
meta-package) exposes the relevant subset.

## Quick Start

```typescript
import { Result, LibUtils, safeRun } from '@vytches/ddd-utils';

// Result — outcome of a domain operation
const ok = Result.ok<number>(42);
const fail = Result.fail<number>(new Error('boom'));
ok.match(
  v => console.log('value', v),
  e => console.error(e)
);

// LibUtils — predicates, UUID, deep equality
const id = LibUtils.getUUID(); // RFC 4122 v4
const same = LibUtils.deepEqual(a, b); // handles Date/Map/Set/RegExp
const empty = LibUtils.isEmpty(value); // robust empty check

// safeRun — never throws, returns [error, value] tuple
const [err, data] = await safeRun(() => fetchUser(id));
if (err) return Result.fail(err);
```

## Key API

| Export                                 | Kind              | Description                                                          |
| -------------------------------------- | ----------------- | -------------------------------------------------------------------- |
| `Result<T, E>`                         | class (re-export) | Outcome wrapper. Canonical source: `@vytches/ddd-contracts`          |
| `Result.ok(value)`                     | static            | Successful result                                                    |
| `Result.fail(error)`                   | static            | Failed result                                                        |
| `Result.empty()`                       | static            | Successful void result                                               |
| `Result.try(fn)`                       | static            | Wrap throwing sync fn into a Result                                  |
| `Result.tryAsync(fn)`                  | static            | Wrap throwing async fn into a Result                                 |
| `.flatMap(fn)`                         | method            | Chain another `Result`-returning step; short-circuits on failure     |
| `.mapError(fn)`                        | method            | Transform the error only, leaving a success value untouched          |
| `.match(onSuccess, onFailure)`         | method            | Collapse to one value at a boundary, no `isFailure` branch needed    |
| `.tap(fn)` / `.tapError(fn)`           | method            | Side effect on success/failure; returns the same `Result` unchanged  |
| `Result.combine(results)`              | static            | First failure wins; success value is a tuple, in input order         |
| `Result.combineWithAllErrors(results)` | static            | Every original error (compacted array), not just the first           |
| `LibUtils.getUUID()`                   | static            | RFC 4122 v4 UUID string                                              |
| `LibUtils.deepEqual(a, b)`             | static            | Structural equality with cycle detection (Date/Map/Set/RegExp aware) |
| `LibUtils.isEmpty(value)`              | static            | Robust empty check (handles `0`, `false`, `MIN_SAFE_INTEGER`, etc.)  |
| `LibUtils.hasValue(value)`             | static            | Inverse of isEmpty                                                   |
| `LibUtils.sleep(ms)`                   | static            | Promise-based delay                                                  |
| `LibUtils.isValidUUID(s)`              | static            | UUID v1–v8 format check                                              |
| `safeRun(fn)`                          | function          | Returns `[Error \| undefined, T \| undefined]`; never throws         |
| `MiddlewarePipelineExecutor`           | class             | Compose `IMiddleware<T>` chains for command/event buses              |
| `IMiddleware<T>`                       | interface         | `handle(ctx, next): Promise<R>`                                      |

## Patterns

### Error-as-value with safeRun

```typescript
import { safeRun, Result } from '@vytches/ddd-utils';

async function loadUser(id: string): Promise<Result<User, Error>> {
  const [err, user] = await safeRun(() => repo.findById(id));
  return err ? Result.fail(err) : Result.ok(user!);
}
```

### Middleware pipeline for a custom event bus

```typescript
import {
  MiddlewarePipelineExecutor,
  type IMiddleware,
} from '@vytches/ddd-utils';

const loggingMiddleware: IMiddleware<MyEvent> = {
  async handle(event, next) {
    console.log('->', event.type);
    const result = await next(event);
    console.log('<-', event.type);
    return result;
  },
};

const pipeline = MiddlewarePipelineExecutor.from([loggingMiddleware]);
await pipeline.execute(event, finalHandler);
```

### Chain Results instead of repeating `isFailure` checks

```typescript
// Avoid: this block repeats once per fallible step
if (x.isFailure) return Result.fail(x.error);

// Prefer: chain another Result-returning step
return x.flatMap(value => nextStep(value));
```

Building several value objects at once? Use `Result.combine` (first failure
wins, values come back as a tuple) or `Result.combineWithAllErrors` (every
failing input reported — the ORIGINAL error objects, in a compacted array, never
flattened to messages):

```typescript
const combined = Result.combine([
  Email.create(dto.email),
  FullName.create(dto.name),
]);
if (combined.isFailure) return Result.fail(combined.error);
const [email, name] = combined.value;
```

The combined error type is inferred, not declared — a plain `Error` entry in a
mixed tuple is ignored as a placeholder, and error types that don't reduce to
one common type (e.g. unrelated sibling classes) infer as `never` instead of a
union. Declare one shared error type across the combined factories to avoid it.

There is no `combineAsync` — `await Promise.all([...])` the individual results
first, then pass the resolved array to `combine`. Full combinator reference
(including the exact `combineWithAllErrors` compaction rule and the `never`
inference gotcha): see `packages/contracts/LLMGUIDE.md`.

## Anti-Patterns

- **Do not use `instanceof Result`** — class identity differs across bundles.
  Use `result.isSuccess` / `result.isFailure` or `Result.match()` instead.
- **Do not import `Result` from `@vytches/ddd-utils` in new code** — prefer
  `@vytches/ddd-contracts` (the canonical home). The utils export is a re-export
  shim kept for backwards compatibility.
- **Do not write a manual `isFailure` check per field** when combining several
  `Result`s — use `Result.combine` / `Result.combineWithAllErrors` instead.
- **Do not put domain logic in `LibUtils`** — it is intentionally generic.
  Domain helpers belong in `@vytches/ddd-domain-primitives` or a bounded
  context.

## Migration Notes

- v0.25.0+ : `Result<T, E>` source moved to `@vytches/ddd-contracts`. Existing
  imports from `@vytches/ddd-utils` continue to work via re-export shim.
