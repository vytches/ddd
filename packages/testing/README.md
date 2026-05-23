# @vytches/ddd-testing

[![npm version](https://badge.fury.io/js/%40vytches%2Fddd-testing.svg)](https://badge.fury.io/js/%40vytches%2Fddd-testing)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **DDD-specific testing utilities: GWT aggregate testing, safe execution, test
> harnesses, and domain seeders**

## Installation

```bash
pnpm add -D @vytches/ddd-testing
```

## What's included

### Given-When-Then (GWT) aggregate testing

| Export              | Kind      | Description                                                                |
| ------------------- | --------- | -------------------------------------------------------------------------- |
| `Test`              | class     | Fluent GWT builder — `Test.given(events).when(command).then(expectations)` |
| `GWTAssertionError` | class     | Thrown when a GWT assertion fails                                          |
| `matching`          | function  | Event matcher helper: `matching(EventClass, { field: value })`             |
| `eventsMatch`       | function  | Returns `true` if two event arrays match                                   |
| `eventArraysMatch`  | function  | Deep match of two event arrays                                             |
| `GivenStep`         | interface | Type for the Given phase                                                   |
| `WhenStep`          | interface | Type for the When phase                                                    |
| `ThenStep`          | interface | Type for the synchronous Then phase                                        |
| `AsyncThenStep`     | interface | Type for the async Then phase                                              |

### Safe execution utilities

| Export                       | Kind     | Description                                                   |
| ---------------------------- | -------- | ------------------------------------------------------------- |
| `safeRun(fn)`                | function | Executes `fn`, returns `[error, result]` tuple — never throws |
| `safeRunTest(fn)`            | function | Like `safeRun` but for test assertions                        |
| `safeRunWithTimeout(fn, ms)` | function | Like `safeRun` with a timeout                                 |
| `expectSuccess(result)`      | function | Asserts the result has no error                               |
| `expectError(result)`        | function | Asserts the result has an error                               |
| `SafeRunResult<T>`           | type     | `[error: unknown, result: T]`                                 |

### Test harnesses

| Export                | Kind      | Description                                                |
| --------------------- | --------- | ---------------------------------------------------------- |
| `TestHarness`         | class     | General-purpose test harness with setup/teardown lifecycle |
| `SimpleTestHarness`   | class     | Simplified version for straightforward scenarios           |
| `TestResourceBuilder` | class     | Builds and tracks disposable test resources                |
| `TestHarnessOptions`  | interface | Configuration for `TestHarness`                            |
| `TestHarnessState`    | interface | Harness state shape                                        |
| `TestResource`        | interface | Resource tracking shape                                    |

### Time control

| Export                | Kind      | Description                                           |
| --------------------- | --------- | ----------------------------------------------------- |
| `TestClock`           | class     | Controllable clock for deterministic time-based tests |
| `TimeScenarioBuilder` | class     | Builds time-advance scenarios                         |
| `withTestClock(fn)`   | function  | Runs `fn` with a fresh `TestClock` injected           |
| `TestClockState`      | interface | Current state of the test clock                       |
| `TimeAdvanceOptions`  | interface | Options for advancing the clock                       |

### Domain seeder framework

| Export               | Kind  | Description                                             |
| -------------------- | ----- | ------------------------------------------------------- |
| `AggregateFactory`   | class | Creates aggregate instances from factory functions      |
| `AggregateSeeder`    | class | Seeds multiple aggregates into a test store             |
| `AIEnhancedSeeder`   | class | Seeder with AI-assisted data generation support         |
| `DomainSeeder`       | class | High-level seeder coordinating multiple aggregate types |
| `EntityIdGenerator`  | class | Generates deterministic entity IDs for tests            |
| `EventSourcedSeeder` | class | Seeds event-sourced aggregates via event replay         |
| `GeographicSeeder`   | class | Generates geographic domain data                        |
| `ScenarioSeeder`     | class | Builds full test scenarios from declarative definitions |
| `StreamingSeeder`    | class | Streams large seed datasets in batches                  |
| `ValueObjectBuilder` | class | Builds value objects for test data                      |

## Quick start

### GWT aggregate testing

```typescript
import { Test, matching } from '@vytches/ddd-testing';

describe('Order aggregate', () => {
  it('should confirm a pending order', async () => {
    await Test.given([
      new OrderCreated({ orderId: 'ord-1', customerId: 'cus-1' }),
    ])
      .when(order => order.confirm())
      .then(events => {
        expect(events).toHaveLength(1);
        expect(matching(OrderConfirmed, { orderId: 'ord-1' })(events[0])).toBe(
          true
        );
      });
  });
});
```

### Safe execution

```typescript
import { safeRun } from '@vytches/ddd-testing';

const [error, result] = await safeRun(() => riskyOperation());
if (error) {
  // handle error
}
```

### Time control

```typescript
import { TestClock, withTestClock } from '@vytches/ddd-testing';

it('should expire sessions after 30 minutes', async () => {
  await withTestClock(async clock => {
    const session = Session.create();
    clock.advance(31 * 60 * 1000); // 31 minutes
    expect(session.isExpired(clock.now())).toBe(true);
  });
});
```

### Domain seeder

```typescript
import { AggregateSeeder, EntityIdGenerator } from '@vytches/ddd-testing';

const idGen = new EntityIdGenerator({ seed: 42 });
const seeder = new AggregateSeeder(orderRepository);

await seeder.seed([
  Order.create(idGen.next(), 'customer-1'),
  Order.create(idGen.next(), 'customer-2'),
]);
```

## Note on safeRun vs production safeRun

`@vytches/ddd-testing` exports its own `safeRun` optimised for test assertions.
The production utility is `safeRun` from `@vytches/ddd-utils`. They have the
same signature but different internals — use the testing version in tests only.

## Package boundaries

`@vytches/ddd-testing` depends on:

- `@vytches/ddd-utils` — `Result`
- `@vytches/ddd-contracts` — aggregate and event types

## License

MIT
