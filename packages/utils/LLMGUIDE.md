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

| Export                       | Kind              | Description                                                          |
| ---------------------------- | ----------------- | -------------------------------------------------------------------- |
| `Result<T, E>`               | class (re-export) | Outcome wrapper. Canonical source: `@vytches/ddd-contracts`          |
| `Result.ok(value)`           | static            | Successful result                                                    |
| `Result.fail(error)`         | static            | Failed result                                                        |
| `Result.empty()`             | static            | Successful void result                                               |
| `Result.try(fn)`             | static            | Wrap throwing sync fn into a Result                                  |
| `Result.tryAsync(fn)`        | static            | Wrap throwing async fn into a Result                                 |
| `LibUtils.getUUID()`         | static            | RFC 4122 v4 UUID string                                              |
| `LibUtils.deepEqual(a, b)`   | static            | Structural equality with cycle detection (Date/Map/Set/RegExp aware) |
| `LibUtils.isEmpty(value)`    | static            | Robust empty check (handles `0`, `false`, `MIN_SAFE_INTEGER`, etc.)  |
| `LibUtils.hasValue(value)`   | static            | Inverse of isEmpty                                                   |
| `LibUtils.sleep(ms)`         | static            | Promise-based delay                                                  |
| `LibUtils.isValidUUID(s)`    | static            | UUID v1–v8 format check                                              |
| `safeRun(fn)`                | function          | Returns `[Error \| undefined, T \| undefined]`; never throws         |
| `MiddlewarePipelineExecutor` | class             | Compose `IMiddleware<T>` chains for command/event buses              |
| `IMiddleware<T>`             | interface         | `handle(ctx, next): Promise<R>`                                      |

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

## Anti-Patterns

- **Do not use `instanceof Result`** — class identity differs across bundles.
  Use `result.isSuccess` / `result.isFailure` or `Result.match()` instead.
- **Do not import `Result` from `@vytches/ddd-utils` in new code** — prefer
  `@vytches/ddd-contracts` (the canonical home). The utils export is a re-export
  shim kept for backwards compatibility.
- **Do not put domain logic in `LibUtils`** — it is intentionally generic.
  Domain helpers belong in `@vytches/ddd-domain-primitives` or a bounded
  context.

## Migration Notes

- v0.25.0+ : `Result<T, E>` source moved to `@vytches/ddd-contracts`. Existing
  imports from `@vytches/ddd-utils` continue to work via re-export shim.
