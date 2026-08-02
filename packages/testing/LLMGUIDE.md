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

| Export                            | Kind           | Purpose                                                                                                                                                                                                                           |
| --------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Test`                            | function       | GWT entry point — `Test(factory).given().when().then()`                                                                                                                                                                           |
| `matching`                        | function       | Partial event matcher for `.then()`                                                                                                                                                                                               |
| `GWTAssertionError`               | class          | Error with formatted GWT context                                                                                                                                                                                                  |
| `safeRun`                         | function       | Execute function, return `[error, result]` tuple                                                                                                                                                                                  |
| `expectError`                     | function       | Assert function throws specific error                                                                                                                                                                                             |
| `expectSuccess`                   | function       | Assert function succeeds                                                                                                                                                                                                          |
| `TestClock`                       | class          | Freeze and advance time in tests                                                                                                                                                                                                  |
| `SimpleTestHarness`               | class          | Test lifecycle: setup/teardown                                                                                                                                                                                                    |
| `TestResourceBuilder`             | class          | Fluent builder for test resources                                                                                                                                                                                                 |
| `AggregateSeeder`                 | class          | Generate test aggregates with seeders                                                                                                                                                                                             |
| `GivenStep`                       | interface      | Return type of `Test()` — start of the GWT chain (see Patterns → GWT)                                                                                                                                                             |
| `WhenStep`                        | interface      | Return type of `.given()` / `.givenNothing()`                                                                                                                                                                                     |
| `ThenStep`                        | interface      | Return type of `.when()`                                                                                                                                                                                                          |
| `AsyncThenStep`                   | interface      | Return type of `.whenAsync()`                                                                                                                                                                                                     |
| `eventsMatch`                     | function       | Structural event comparison (eventName + deep-equal payload, ignores metadata) — what `.then()` uses internally; exported for custom matchers/reporters                                                                           |
| `eventArraysMatch`                | function       | Structural comparison of two event arrays (order matters)                                                                                                                                                                         |
| `safeRunTest`                     | function       | Like `safeRun`, but tags caught errors with a `testContext` string for debugging                                                                                                                                                  |
| `safeRunWithTimeout`              | function       | Async `safeRun` variant that races the function against a timeout                                                                                                                                                                 |
| `SafeRunResult`                   | type           | `[error, result]` tuple type returned by `safeRun` / `safeRunTest` / `safeRunWithTimeout`                                                                                                                                         |
| `TimeScenarioBuilder`             | class          | Fluent builder for multi-step time scenarios — created via `TestClock.createTimeScenario()`                                                                                                                                       |
| `withTestClock`                   | function       | Method decorator that freezes/restores a `TestClock` around a test method                                                                                                                                                         |
| `TestClockState`                  | type           | Return type of `TestClock.getState()`                                                                                                                                                                                             |
| `TimeAdvanceOptions`              | interface      | Options object for `TestClock.advance()` / `TimeScenarioBuilder.advanceBy()`                                                                                                                                                      |
| `TestHarness`                     | abstract class | Base class for custom test harnesses — subclass and implement the `perform*` lifecycle hooks                                                                                                                                      |
| `TestHarnessOptions`              | interface      | Constructor options for `TestHarness` / `SimpleTestHarness`                                                                                                                                                                       |
| `TestHarnessState`                | interface      | Return type of `TestHarness.getState()`                                                                                                                                                                                           |
| `TestResource`                    | interface      | Disposable resource tracked by `TestHarness`, built by `TestResourceBuilder`                                                                                                                                                      |
| `InMemoryOutboxRepository`        | class          | In-memory `IOutboxRepository` for driving a real `OutboxProcessor` in tests, no database needed                                                                                                                                   |
| `InMemoryOutboxRepositoryOptions` | interface      | Constructor options for `InMemoryOutboxRepository` (injectable `clock` for deterministic aging checks)                                                                                                                            |
| `DomainSeeder`                    | class          | Central seeding orchestrator — `forAggregate()`, `eventSourcedScenario()`, `scenario()`, `geographicScenario()`, `aiEnhancedScenario()`                                                                                           |
| `AggregateFactory`                | class          | Lower-level factory that `AggregateSeeder` wraps internally — defaults, sequences, value objects, templates                                                                                                                       |
| `EntityIdGenerator`               | class          | Generates `EntityId`s: uuid, text, sequential, pattern-based, plus domain presets (`users`, `orders`, `products`, `events`)                                                                                                       |
| `ValueObjectBuilder`              | class          | Builds DDD value objects with constraints, business-rule validation, and templates                                                                                                                                                |
| `ScenarioSeeder`                  | class          | Multi-aggregate scenario seeder (crisis / multi-tenant / saga modes), returned by `DomainSeeder.scenario()` and friends. Current implementation is a scaffold — chain methods return `this`, `seed()` resolves to an empty result |
| `EventSourcedSeeder`              | class          | Event-stream / history seeder for event-sourced aggregates, returned by `DomainSeeder.eventSourcedScenario()`. Current implementation is a scaffold — `generateWithHistory()` resolves to an empty result                         |
| `AIEnhancedSeeder`                | class          | AI-assisted realistic data generation seeder. **API may change before v1.0.**                                                                                                                                                     |
| `StreamingSeeder`                 | class          | High-throughput streaming seeder for millions of aggregates (batching, backpressure, metrics). **API may change before v1.0.**                                                                                                    |
| `GeographicSeeder`                | class          | Location-aware seeder for geographic scenarios. **API may change before v1.0.**                                                                                                                                                   |

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

Each fluent step is a documented interface you can reuse in helper types:
`Test()` returns `GivenStep`, `.given()`/`.givenNothing()` return `WhenStep`,
`.when()` returns `ThenStep`, and `.whenAsync()` returns `AsyncThenStep`.
`eventsMatch`/`eventArraysMatch` are the same structural comparators `.then()`
uses internally — reuse them if you write a custom reporter or a non-Vitest
assertion helper.

### Safe Execution

```typescript
import {
  safeRun,
  safeRunTest,
  safeRunWithTimeout,
  expectError,
} from '@vytches/ddd-testing';

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

// safeRunTest tags the caught error with a testContext label (useful when
// you re-run the same helper across many test cases and want to know which
// one failed from the error alone)
const [taggedError] = safeRunTest(
  () => riskyOperation(),
  'creating-order-with-invalid-sku'
);

// safeRunWithTimeout races the function against a timeout and returns the
// same [error, result] tuple shape — no unhandled rejection on timeout
const [timeoutError, value] = await safeRunWithTimeout(
  () => slowExternalCall(),
  5000,
  'external-call'
);
```

### Time Control

```typescript
import {
  TestClock,
  TimeScenarioBuilder,
  withTestClock,
} from '@vytches/ddd-testing';

const clock = new TestClock();
clock.freeze(new Date('2026-01-01'));
// Date.now() returns frozen time
clock.advance({ hours: 2 });
// Date.now() returns 2026-01-01T02:00:00
clock.unfreeze();
```

`TestClock.createTimeScenario()` returns a `TimeScenarioBuilder` for multi-step
time-dependent flows — freeze, execute, advance, execute again, then run and
collect every step's result:

```typescript
const results = await TestClock.createTimeScenario()
  .freezeAt(new Date('2026-01-01'))
  .execute(() => orderService.createOrder())
  .advanceBy({ hours: 2 })
  .execute(() => orderService.checkExpiry())
  .run();
// results[0] is the createOrder() return value, results[1] is checkExpiry()'s
```

`withTestClock` is a method decorator that freezes/restores a `TestClock` around
a single test method:

```typescript
class OrderServiceTest {
  @withTestClock({ freezeAt: new Date('2026-01-01') })
  async testExpiryLogic() {
    // Date.now() is frozen at 2026-01-01 for the duration of this method
  }
}
```

### Domain-Aware Seeding

`DomainSeeder` is the entry point for the seeder framework — it exposes factory
methods that return specialized seeders sharing the same global configuration
(`DomainSeeder.configure()`).

```typescript
import {
  DomainSeeder,
  EntityIdGenerator,
  ValueObjectBuilder,
} from '@vytches/ddd-testing';

// DomainSeeder.forAggregate() returns an AggregateSeeder — combine it with
// EntityIdGenerator and ValueObjectBuilder for realistic, valid test data
const emailBuilder = new ValueObjectBuilder(EmailVO).withConstraints({
  pattern: /^[^@]+@example\.com$/,
});

const userSeeder = DomainSeeder.forAggregate(UserAggregate)
  .withDefaults({ status: 'active' })
  .withSequence('id', () => EntityIdGenerator.sequential('user'))
  .withValueObject('email', () => emailBuilder.build().then(r => r.value))
  .withCapabilities(['audit', 'events']);

const usersResult = await userSeeder.buildMany(10);
if (usersResult.isSuccess) {
  const users = usersResult.value; // UserAggregate[]
}
```

`EntityIdGenerator` on its own, for consistent `EntityId`s outside a seeder:

```typescript
const userId = EntityIdGenerator.uuid();
const orderId = EntityIdGenerator.sequential('order'); // "order-001"
const auditId = EntityIdGenerator.pattern(
  'AUDIT-{{year}}{{month}}-{{sequence:5}}'
);

// Built-in domain presets
const standardUserId = EntityIdGenerator.presets.users.standard(); // "USER-001"
```

`ValueObjectBuilder` on its own, when you need one valid value object rather
than a whole aggregate:

```typescript
const ageBuilder = new ValueObjectBuilder(AgeVO).withConstraints({
  min: 18,
  max: 120,
});
const ageResult = await ageBuilder.build(); // Result<AgeVO, Error>
```

Advanced: `AggregateFactory` is the lower-level engine `AggregateSeeder` wraps.
Use it directly only if you need defaults/sequences/templates without
`AggregateSeeder`'s capability and domain-event layer:

```typescript
import { AggregateFactory } from '@vytches/ddd-testing';

const factory = new AggregateFactory(UserAggregate)
  .withDefaults({ status: 'active' })
  .withSequence('email', n => `user${n}@example.com`);

const userResult = await factory.create({ name: 'John Doe' });
```

`ScenarioSeeder` (`DomainSeeder.scenario()`, `.crisisScenario()`,
`.multiTenantScenario()`, `.sagaScenario()`) and `EventSourcedSeeder`
(`DomainSeeder.eventSourcedScenario()`) exist as documented entry points, but
their current implementation is a scaffold: chain methods (`withBaseline`,
`injectCrisis`, `withEventStream`, `withSnapshots`, ...) return `this` without
side effects, and the terminal `seed()` / `generateWithHistory()` resolve to an
empty stub result. Prefer `DomainSeeder.forAggregate()` (`AggregateSeeder`) for
anything you depend on today.

`AIEnhancedSeeder`, `StreamingSeeder`, and `GeographicSeeder` are pre-1.0 /
experimental — see the Key API table above for their surface. API may change
before v1.0.

### Outbox Testing

`InMemoryOutboxRepository` implements `IOutboxRepository` in memory so a real
`OutboxProcessor` (from `@vytches/ddd-messaging`) can run end-to-end in tests
without a database. Combine it with `TestClock` for deterministic aging checks
(`processAfter`, stale-processing resets):

```typescript
import { InMemoryOutboxRepository, TestClock } from '@vytches/ddd-testing';

const clock = TestClock.create();
clock.freeze(new Date('2026-01-01'));

const outbox = new InMemoryOutboxRepository({
  clock: () => clock.now().getTime(),
});

await outbox.saveMessage({
  id: '',
  messageType: 'OrderPlaced',
  payload: { orderId: 'order-1' },
  // ...remaining IOutboxMessage fields (see @vytches/ddd-messaging)
});

// Advance frozen time, then resolve anything stuck in PROCESSING past the threshold
clock.advance({ minutes: 10 });
const resetCount = await outbox.resetStaleProcessing(
  new Date(clock.now().getTime() - 5 * 60_000)
);

expect(outbox.size()).toBe(1);
outbox.clear(); // isolate the next test
```

### Custom Test Harness

`TestHarness` is an abstract base class — subclass it and implement the
`perform*` lifecycle hooks. Use `registerResource()` with a
`TestResourceBuilder`-built `TestResource` for automatic cleanup on teardown:

```typescript
import { TestHarness, TestResourceBuilder } from '@vytches/ddd-testing';

class DatabaseTestHarness extends TestHarness {
  private db?: Database;

  protected async performInitialization(): Promise<void> {
    this.db = await Database.connect(TEST_DB_URL);
  }

  protected async performSetup(): Promise<void> {
    await this.db!.migrate();
    this.registerResource(
      TestResourceBuilder.create('db-transaction')
        .withDisposal(() => this.db!.rollback())
        .build()
    );
  }

  protected async performTeardown(): Promise<void> {
    await this.db!.rollback();
  }

  protected async performReset(): Promise<void> {
    await this.db!.truncateAll();
  }

  protected async performDisposal(): Promise<void> {
    await this.db!.disconnect();
  }
}

const harness = await new DatabaseTestHarness({
  autoCleanup: true,
}).initialize();
await harness.setup();
// ... run the test using harness ...
await harness.teardown();
```

For a single test file that just needs a setup/teardown function without a
subclass, use the already-documented `SimpleTestHarness` instead.

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

**Sharing an `InMemoryOutboxRepository` instance across tests without
`clear()`.** Messages persist across tests using the same instance, causing
state leakage; call `.clear()` in `beforeEach`/`afterEach`.

**Relying on `ScenarioSeeder`, `EventSourcedSeeder`, `AIEnhancedSeeder`,
`StreamingSeeder`, or `GeographicSeeder` for fixtures you depend on today.**
`ScenarioSeeder`/`EventSourcedSeeder` currently resolve to stub/empty results;
the other three are pre-1.0 and may change API before v1.0. Prefer
`DomainSeeder.forAggregate()` (`AggregateSeeder`) for production test suites.

## Hidden Features

`GWTAssertionError` contains structured data (`givenEvents`, `expectedEvents`,
`actualEvents`) — useful for custom test reporters.

`Test()` works with any object implementing `IAggregateRoot` — not just
`AggregateRoot` subclasses.

The `whenAsync()` variant supports `Promise`-returning commands for aggregates
that do async validation.

## Package Dependencies

**Depends on:** `@vytches/ddd-contracts` (interfaces, `EntityId` type),
`@vytches/ddd-aggregates` (AggregateRoot for type constraints),
`@vytches/ddd-value-objects` (`EntityId` factory methods used by
`EntityIdGenerator` / `AggregateFactory`), `@vytches/ddd-messaging`
(`IOutboxRepository`, `MessageStatus`, `MessagePriority` used by
`InMemoryOutboxRepository`), `@vytches/ddd-utils` (`Result<T>` used throughout
the seeder framework), `@vytches/ddd-domain-primitives`, and `@faker-js/faker`
(realistic data generation in the seeder framework).

**Depended on by:** consumer test suites.
