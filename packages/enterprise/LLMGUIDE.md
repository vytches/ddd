# @vytches/ddd (enterprise meta-package) - LLM Guide

## Purpose

The convenience meta-package: re-exports the curated public surface of all 21
packages under a single import. Use this when you want one entry point; use
sub-packages directly when you care about tree-shaking the parts you don't need.

```bash
npm install @vytches/ddd                  # this package — gets everything
# or
npm install @vytches/ddd-aggregates @vytches/ddd-events @vytches/ddd-cqrs
```

The meta-package handles **conflict resolution** when two sub-packages expose
symbols with the same name — see "Disambiguation" below.

## Quick Start

```typescript
import {
  AggregateRoot,
  EntityId,
  DomainEvent,
  BaseValueObject,
  Specification,
  Result,
} from '@vytches/ddd';

class Order extends AggregateRoot<string> {
  private items: Array<{ sku: string; qty: number }> = [];

  constructor() {
    super({ id: EntityId.create(), version: 0 });

    this.registerEventHandler('ItemAdded', payload => {
      this.items = [...this.items, payload];
    });
  }

  addItem(sku: string, qty: number): Result<void, Error> {
    if (qty <= 0) return Result.fail(new Error('qty must be positive'));
    this.apply(new ItemAddedEvent({ sku, qty }));
    return Result.empty();
  }
}
```

## What's Included

| Sub-package             | What it brings                                              |
| ----------------------- | ----------------------------------------------------------- |
| `ddd-contracts`         | Foundation types: `Result`, `EntityId`, `IDomainEvent`, ... |
| `ddd-domain-primitives` | Errors (`NotFoundError`, ...), `IActor`                     |
| `ddd-value-objects`     | `BaseValueObject`, `EntityId` impl                          |
| `ddd-aggregates`        | `AggregateRoot`, capabilities (snapshot, audit, versioning) |
| `ddd-events`            | `DomainEvent`, `IntegrationEvent`, `UnifiedEventBus`        |
| `ddd-cqrs`              | `CommandBus`, `QueryBus`, decorators                        |
| `ddd-policies`          | `Specification`, `BaseBusinessPolicy`, composition          |
| `ddd-validation`        | Schema/rule-based validators                                |
| `ddd-repositories`      | `BaseRepository`, `IRepository`                             |
| `ddd-projections`       | `BaseProjection`, `ProjectionEngine`                        |
| `ddd-acl`               | Anti-corruption layer + context routing                     |
| `ddd-domain-services`   | `AsyncDomainService`, `@DomainService()`                    |
| `ddd-resilience`        | Circuit breaker, retry, bulkhead, timeout                   |
| `ddd-messaging`         | Outbox pattern (storage-agnostic)                           |
| `ddd-utils`             | `LibUtils`, `safeRun`, middleware pipeline                  |
| `ddd-logging`           | `DefaultLogger`, providers                                  |
| `ddd-di`                | Service locator, container builder                          |
| `ddd-testing`           | Test harness, fixtures, builders                            |

NestJS integration is shipped separately as `@vytches/ddd-nestjs` (peer dep on
`@nestjs/common`, not pulled in by default).

## Disambiguation

A few symbols exist in multiple sub-packages. The meta-package resolves them as
follows:

| Symbol         | Re-exported from    | Reason                                               |
| -------------- | ------------------- | ---------------------------------------------------- |
| `EntityId`     | `ddd-value-objects` | The concrete class (preferred for consumers)         |
| `BaseEntityId` | `ddd-contracts`     | The abstract contract (rare; aliased to avoid clash) |
| `Result`       | `ddd-contracts`     | Canonical home as of v0.25.0                         |

If you import from a sub-package directly, you get that package's view — which
may differ from what `@vytches/ddd` re-exports. Stick to one source per consumer
codebase.

## When to use sub-packages instead

- **You need tighter bundle size** — only import what you use, no barrel
  re-exports.
- **You only need primitives** —
  `npm install @vytches/ddd-aggregates @vytches/ddd-events` pulls ~30% the
  surface of the meta-package.
- **You want explicit dependency boundaries** — sub-packages document what layer
  each piece belongs to.

## Anti-Patterns

- **Do not mix imports from `@vytches/ddd` and `@vytches/ddd-*` in the same
  consumer** — class identity may differ between them after Vite bundling. Pick
  one strategy per project.
- **Do not import the entire library inside an aggregate file** — aggregates
  should depend only on `@vytches/ddd-aggregates` (or sub-packages a notch
  below). Avoid pulling in CQRS, messaging, etc. from the domain layer.
- **Do not assume every sub-package's public API is re-exported here** — the
  meta-package curates. Some experimental APIs are sub-package-only on purpose.
