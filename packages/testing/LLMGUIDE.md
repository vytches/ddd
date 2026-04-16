# @vytches/ddd-testing - LLM Guide

## Purpose

Test utilities for DDD applications: GWT (Given-When-Then) aggregate testing,
safe execution helpers, time control, and domain-aware test data seeders.

## Quick Start

```typescript
import { Test, matching } from '@vytches/ddd-testing';

// Given-When-Then aggregate testing
Test(() => new Order({ id: EntityId.create(), version: 0 }))
  .given(new OrderCreated({ customerId: 'c1' }))
  .when(order => order.place({ items }))
  .then(new OrderPlaced({ itemCount: 2 }));
```

## Key API

| Export                | Kind     | Purpose                                                 |
| --------------------- | -------- | ------------------------------------------------------- |
| `Test`                | function | GWT entry point — `Test(factory).given().when().then()` |
| `matching`            | function | Partial event matcher for `.then()`                     |
| `GWTAssertionError`   | class    | Error with formatted GWT context                        |
| `safeRun`             | function | Execute function, return `[error, result]` tuple        |
| `expectError`         | function | Assert function throws specific error                   |
| `expectSuccess`       | function | Assert function succeeds                                |
| `TestClock`           | class    | Freeze and advance time in tests                        |
| `SimpleTestHarness`   | class    | Test lifecycle: setup/teardown                          |
| `TestResourceBuilder` | class    | Fluent builder for test resources                       |
| `AggregateSeeder`     | class    | Generate test aggregates with seeders                   |

## Patterns

### GWT Aggregate Testing (Preferred)

```typescript
import { Test, matching, GWTAssertionError } from '@vytches/ddd-testing';

// Test event production
Test(() => new Order({ id: EntityId.create(), version: 0 }))
  .given(new OrderCreated({ customerId: 'c1' }))
  .when(order => order.addItem('SKU-1', 2))
  .then(new ItemAdded({ sku: 'SKU-1', qty: 2 }));

// Test domain errors
Test(() => new Order({ id: EntityId.create(), version: 0 }))
  .given(new OrderCreated({ customerId: 'c1' }))
  .when(order => order.place())
  .thenError('ORDER_EMPTY');

// Test no events produced
Test(() => new Order({ id: EntityId.create(), version: 0 }))
  .given(new OrderCreated({ customerId: 'c1' }))
  .when(() => {
    /* no-op */
  })
  .thenNothing();

// Partial payload matching (check only some fields)
Test(() => new Order({ id: EntityId.create(), version: 0 }))
  .given(new OrderCreated({ customerId: 'c1' }))
  .when(order => order.addItem('SKU-1', 5))
  .then(matching(ItemAdded, { sku: 'SKU-1' })); // ignores qty

// Async commands
await Test(() => new Order({ id: EntityId.create(), version: 0 }))
  .given(new OrderCreated({ customerId: 'c1' }))
  .whenAsync(async order => await order.validateAndPlace(items))
  .then(new OrderPlaced({ itemCount: 2 }));
```

### Safe Execution

```typescript
import { safeRun, expectError } from '@vytches/ddd-testing';

// safeRun returns [error, result] tuple — never throws
const [error, result] = safeRun(() => riskyOperation());
if (error) {
  /* handle */
}

// expectError asserts a specific error type
const err = expectError(
  () => EntityId.fromUUID('invalid'),
  InvalidParameterError
);
```

### Time Control

```typescript
import { TestClock } from '@vytches/ddd-testing';

const clock = new TestClock();
clock.freeze(new Date('2026-01-01'));
// Date.now() returns frozen time
clock.advance({ hours: 2 });
// Date.now() returns 2026-01-01T02:00:00
clock.unfreeze();
```

## Anti-Patterns

**Using raw Vitest assertions instead of GWT for aggregate tests.** The GWT API
eliminates boilerplate (create aggregate, load history, extract events, assert)
and gives contextual error messages.

**Forgetting to pass a factory function to Test().** `Test` takes a factory
`() => T`, not a class. The factory must create a fresh aggregate each time.

**Testing internal state instead of events.** GWT tests verify what events the
aggregate produces, not its internal properties. This aligns with event
sourcing.

**Not using `matching()` for large payloads.** When you only care about a few
fields, use `matching(EventClass, { relevantField: value })` instead of
constructing a full event with all fields.

## Hidden Features

`GWTAssertionError` contains structured data (`givenEvents`, `expectedEvents`,
`actualEvents`) — useful for custom test reporters.

`Test()` works with any object implementing `IAggregateRoot` — not just
`AggregateRoot` subclasses.

The `whenAsync()` variant supports `Promise`-returning commands for aggregates
that do async validation.

## Package Dependencies

**Depends on:** `@vytches/ddd-contracts` (interfaces), `@vytches/ddd-aggregates`
(AggregateRoot for type constraints).

**Depended on by:** consumer test suites.
