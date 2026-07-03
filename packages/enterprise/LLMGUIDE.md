# @vytches/ddd (enterprise meta-package) - LLM Guide

## Purpose

The convenience meta-package: re-exports the curated public surface of 16 of the
monorepo's sub-packages under a single import (verified against
`packages/enterprise/package.json` dependencies and
`packages/enterprise/src/index.ts`). Use this when you want one entry point; use
sub-packages directly when you care about tree-shaking the parts you don't need.

`@vytches/ddd-nestjs` and `@vytches/ddd-testing` exist in the monorepo but are
**not** re-exported here — see "What's Included" below for why.
`@vytches/ddd-logging` was removed from the monorepo entirely (VS-010); it no
longer exists as a package.

```bash
npm install @vytches/ddd                  # this package — gets everything
# or
npm install @vytches/ddd-aggregates @vytches/ddd-events @vytches/ddd-cqrs
```

The meta-package handles **conflict resolution** when two sub-packages expose
symbols with the same name — see "Naming Conflict Resolution" below.

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

For the full API of any row below — every exported class, type, and function —
read that package's own guide at `packages/<sub-package>/LLMGUIDE.md`. This
table only gives a curated taste; it is not row-by-row parity with those files.

| Sub-package             | What it brings                                              | Full API                                     |
| ----------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| `ddd-contracts`         | Foundation types: `Result`, `EntityId`, `IDomainEvent`, ... | See `packages/contracts/LLMGUIDE.md`         |
| `ddd-domain-primitives` | Errors (`NotFoundError`, ...), `IActor`                     | See `packages/domain-primitives/LLMGUIDE.md` |
| `ddd-value-objects`     | `BaseValueObject`, `EntityId` impl                          | See `packages/value-objects/LLMGUIDE.md`     |
| `ddd-aggregates`        | `AggregateRoot`, capabilities (snapshot, audit, versioning) | See `packages/aggregates/LLMGUIDE.md`        |
| `ddd-events`            | `DomainEvent`, `IntegrationEvent`, `UnifiedEventBus`        | See `packages/events/LLMGUIDE.md`            |
| `ddd-cqrs`              | `CommandBus`, `QueryBus`, decorators                        | See `packages/cqrs/LLMGUIDE.md`              |
| `ddd-policies`          | `Specification`, `BaseBusinessPolicy`, composition          | See `packages/policies/LLMGUIDE.md`          |
| `ddd-validation`        | Schema/rule-based validators, `ValidationError`             | See `packages/validation/LLMGUIDE.md`        |
| `ddd-repositories`      | `IBaseRepository`, `IRepository`, `IUnitOfWork`             | See `packages/repositories/LLMGUIDE.md`      |
| `ddd-projections`       | `BaseProjection`, `ProjectionEngine`                        | See `packages/projections/LLMGUIDE.md`       |
| `ddd-acl`               | Anti-corruption layer + context routing                     | See `packages/acl/LLMGUIDE.md`               |
| `ddd-domain-services`   | `AsyncDomainService`, `@DomainService()`                    | See `packages/domain-services/LLMGUIDE.md`   |
| `ddd-resilience`        | Circuit breaker, retry, bulkhead, timeout                   | See `packages/resilience/LLMGUIDE.md`        |
| `ddd-messaging`         | Outbox pattern (storage-agnostic)                           | See `packages/messaging/LLMGUIDE.md`         |
| `ddd-utils`             | `LibUtils`, `safeRun`, middleware pipeline                  | See `packages/utils/LLMGUIDE.md`             |
| `ddd-di`                | Service locator, container builder                          | See `packages/di/LLMGUIDE.md`                |

**Not re-exported here** (confirmed against `packages/enterprise/package.json` —
neither is a dependency of this package):

| Package       | Status                                                                                                                                                                                                                                                                                  | Full API                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `ddd-testing` | Exists in the monorepo as dev/test-only tooling; not pulled into the production meta-package. Install it directly if you need it.                                                                                                                                                       | See `packages/testing/LLMGUIDE.md` |
| `ddd-nestjs`  | Shipped separately (peer dep on `@nestjs/common`), not pulled in by default.                                                                                                                                                                                                            | See `packages/nestjs/LLMGUIDE.md`  |
| `ddd-logging` | Removed from the monorepo entirely (VS-010). The library now only logs its own internal diagnostics (`configureDiagnostics`/`DiagnosticsSink`, re-exported here from `ddd-contracts`) — it does not ship an application logging layer. No package or LLMGUIDE.md exists for it anymore. | N/A — package removed              |

## Naming Conflict Resolution

This section was re-derived by diffing every exported symbol name across the 16
re-exported packages' `src/index.ts` barrels (script-assisted, not manual
skimming) and then reading `packages/enterprise/src/index.ts` to see, for each
collision, which package's version actually reaches a consumer of
`@vytches/ddd`. "Re-exported from" below is the package whose declaration wins —
i.e. what `import { X } from '@vytches/ddd'` actually resolves to.

**Real conflicts** — two packages export a _different_ declaration under the
same name, and the meta-package must pick a winner:

| Symbol                  | Re-exported from      | Reason                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EntityId`              | `ddd-value-objects`   | The concrete class (preferred for consumers). `ddd-contracts`' own `EntityId` is aliased to `BaseEntityId` instead of being dropped.                                                                                                                                                                                                                                                                                  |
| `BaseEntityId`          | `ddd-contracts`       | `ddd-contracts`' `EntityId` renamed on import (`export { EntityId as BaseEntityId } from '@vytches/ddd-contracts'`) specifically to avoid clashing with the `ddd-value-objects` version.                                                                                                                                                                                                                              |
| `IAggregateCapability`  | `ddd-contracts`       | Documented in source: "`IAggregateCapability`: Primary: `IAggregateCapability` (from `@vytches/ddd-contracts`) — Foundation interface" (comment block, `packages/enterprise/src/index.ts`). `ddd-aggregates` also declares its own `IAggregateCapability`, which loses.                                                                                                                                               |
| `ServiceNotFoundError`  | `ddd-domain-services` | Documented in source: "DI exports (`ServiceNotFoundError` conflict resolved - domain-services version takes precedence)" (`packages/enterprise/src/index.ts`, above the `ddd-di` export block). `ddd-di`'s own `ServiceNotFoundError` class is deliberately left out of the curated `ddd-di` export list.                                                                                                             |
| `IProjectionCapability` | `ddd-contracts`       | `ddd-contracts` explicitly names `IProjectionCapability` in its curated type export list; `ddd-projections`' own type of the same name loses per standard ES-module rule (an explicit named export beats an ambiguous `export *`). No comment in source explains _why_ contracts should win here — no documented rationale found in source, but the outcome is consistent with the `IAggregateCapability` case above. |
| `IRepository`           | `ddd-repositories`    | `ddd-contracts` also declares a type `IRepository`, but `packages/enterprise/src/index.ts` deliberately omits it from the curated `ddd-contracts` type-export list (verified by reading the full list at lines 12–72), while `export * from '@vytches/ddd-repositories'` supplies it. No comment explains the omission — no documented rationale found in source.                                                     |
| `IRepositoryProvider`   | `ddd-repositories`    | Same pattern as `IRepository` — declared in both `ddd-contracts` and `ddd-repositories`; the contracts version is omitted from the curated export list. No documented rationale found in source.                                                                                                                                                                                                                      |
| `IExtendedRepository`   | `ddd-repositories`    | Same pattern as `IRepository` — no documented rationale found in source.                                                                                                                                                                                                                                                                                                                                              |
| `IUnitOfWork`           | `ddd-repositories`    | Same pattern as `IRepository` — no documented rationale found in source.                                                                                                                                                                                                                                                                                                                                              |

**Pass-throughs** — the symbol appears in two packages' barrels, but the second
package literally re-exports the first package's identical declaration (not a
competing implementation), so there is no real ambiguity:

| Symbol                                    | Canonical source | Notes                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Result`                                  | `ddd-contracts`  | Moved to `ddd-contracts` in REL-008. `ddd-utils` re-exports it via a zero-cost shim (`packages/utils/src/result.ts`) for backward compatibility, and `ddd-policies` re-exports the type from `ddd-utils`. `@vytches/ddd` re-exports the `ddd-utils` path (`export { Result } from '@vytches/ddd-utils'`) — it is the same class either way. |
| `ISpecification`, `IAsyncSpecification`   | `ddd-contracts`  | `ddd-policies` re-exports these two types verbatim (`export type { IAsyncSpecification, ISpecification } from '@vytches/ddd-contracts'`).                                                                                                                                                                                                   |
| `IEntityId`, `IEntityIdFactory`, `IdType` | `ddd-contracts`  | `ddd-value-objects` re-exports these three types verbatim from `ddd-contracts` for convenience.                                                                                                                                                                                                                                             |

**Discrepancies found in the source's own conflict-resolution comment** (the
`NAMING CONFLICT RESOLUTION` block at the bottom of
`packages/enterprise/src/index.ts`) that this diff pass could not corroborate
against current exports — flagged here rather than silently dropped:

- The comment lists `ValidationError` as resolved in favor of
  `ddd-domain-primitives`. As of this check, `ddd-domain-primitives` does
  **not** export a symbol named `ValidationError` (verified by reading
  `packages/domain-primitives/src/index.ts` in full) — only `ddd-validation`
  does
  (`export { ValidationError, ValidationErrors } from './validation-error'`).
  There is currently no cross-package `ValidationError` collision; the comment
  appears stale.
- The comment lists `ExecutionContext` as resolved in favor of `ddd-cqrs` "most
  commonly used." No other re-exported package declares a symbol named
  `ExecutionContext` (verified across all 16 packages' barrels) — the comment
  may be describing the intra-package distinction between `ddd-cqrs`'s
  `CQRSExecutionContext` class and its `ExecutionContext` type rather than a
  true cross-package conflict.

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
