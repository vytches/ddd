# @vytches/ddd-utils

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-utils.svg)](https://badge.fury.io/js/%40vytches%2Fddd-utils)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Foundation utilities: Result pattern, safeRun, LibUtils, and middleware pipeline**

## Installation

```bash
pnpm add @vytches/ddd-utils
```

## What's included

| Export | Kind | Description |
|--------|------|-------------|
| `Result<T, E>` | class | Functional error handling — `Result.ok(value)` / `Result.fail(error)` |
| `safeRun(fn)` | function | Executes `fn` and returns `[error, result]` tuple; never throws |
| `LibUtils` | class | Static helpers: `LibUtils.getUUID()`, isEmpty checks, type guards |
| `MiddlewarePipelineExecutor` | class | Composes and executes an ordered middleware chain |
| `IMiddleware<TIn, TOut>` | interface | Middleware contract for the pipeline |
| `MiddlewareHandler<TIn, TOut>` | type | Handler function type |
| `SimpleHandler<T>` | type | Single-argument handler shorthand |

## Result pattern

`Result<T, E>` is a re-export from `@vytches/ddd-contracts` for backwards
compatibility. New code may import directly from `@vytches/ddd-contracts`.

```typescript
import { Result } from '@vytches/ddd-utils';

function divide(a: number, b: number): Result<number, Error> {
  if (b === 0) return Result.fail(new Error('Division by zero'));
  return Result.ok(a / b);
}

const result = divide(10, 2);
if (result.isSuccess) {
  console.log(result.value); // 5
} else {
  console.error(result.error.message);
}
```

## safeRun

Converts a throwing function into an `[error, result]` tuple. Works with both
sync and async functions.

```typescript
import { safeRun } from '@vytches/ddd-utils';

// async
const [err, user] = await safeRun(() => userRepository.findById('123'));
if (err) {
  console.error('Not found:', err.message);
  return;
}
console.log(user.name);

// sync
const [parseErr, json] = safeRun(() => JSON.parse(rawInput));
```

## LibUtils

```typescript
import { LibUtils } from '@vytches/ddd-utils';

const id = LibUtils.getUUID(); // UUID v4 string
```

## Middleware pipeline

```typescript
import { MiddlewarePipelineExecutor } from '@vytches/ddd-utils';
import type { IMiddleware } from '@vytches/ddd-utils';

class LoggingMiddleware implements IMiddleware<Request, Response> {
  async handle(req: Request, next: () => Promise<Response>): Promise<Response> {
    console.log('Request:', req.url);
    const res = await next();
    console.log('Response:', res.status);
    return res;
  }
}

const pipeline = new MiddlewarePipelineExecutor([new LoggingMiddleware()]);
const response = await pipeline.execute(request, () => handler(request));
```

## Package boundaries

`@vytches/ddd-utils` depends on:
- `@vytches/ddd-contracts` — `Result` (re-exported from there)
- `uuid` — for `LibUtils.getUUID()`

## License

MIT
