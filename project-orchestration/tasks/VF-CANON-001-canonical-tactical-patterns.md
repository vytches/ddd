# Task: Add canonical DDD tactical patterns (Entity, DomainService, DomainFactory)

## Task Metadata

```yaml
task_id: VF-CANON-001
title: Bring tactical pattern catalog to canonical Evans/Vernon shape
type: feature
priority: normal
complexity: medium
estimated_time: 8h
actual_time: 1h
created_by: agent (ddd-compliance-guardian 2026-05-08)
created_at: 2026-05-08
completed_at: 2026-05-09
status: completed
release_target: post-v0.25 (delivered early as part of v0.25.0-beta.1 prep)
```

## ✅ Resolved (2026-05-09)

### What was delivered

**1. `Entity<TId>` abstract class** (`packages/aggregates/src/core/entity.ts`):

- Base for non-root domain entities (OrderLine, Address, etc.)
- Identity-based `equals()` via `EntityId.equals()` — attribute differences
  ignored
- Sibling to `AggregateRoot<TId>` (not parent — non-breaking add)
- Exported from `@vytches/ddd-aggregates`

**2. `PlainDomainService` abstract class**
(`packages/domain-services/src/plain-domain-service.ts`):

- **Bare baseline** — only `serviceId`, no logger, no event bus, no UoW
- For users not running DI containers, who want pure stateless operation classes
- Named `PlainDomainService` because `DomainService` is already the
  auto-discovery decorator name (avoiding breaking rename)
- Exported from `@vytches/ddd-domain-services`

**3. `IDomainFactory<TAgg, TProps>` + `IAsyncDomainFactory`** interfaces
(`packages/contracts/src/aggregates/domain-factory.interface.ts`):

- First-class Factory tactical pattern, sibling to `IRepository`
- `create(props): Result<TAgg, Error>` returns Result (not throwing)
- Async variant for factories that need DB lookups during creation
- Exported from `@vytches/ddd-contracts`

### Tests added

- `packages/aggregates/tests/entity.test.ts` — 7 tests covering identity, equals
  semantics, null/undefined safety, subclassing
- `packages/domain-services/tests/plain-domain-service.test.ts` — 5 tests
  covering serviceId, infra-free guarantee, statelessness
- `packages/contracts/tests/aggregates/domain-factory.spec.ts` — 6 tests for
  sync + async factory contracts

### Snapshots updated

- aggregates: `Entity` added
- domain-services: `PlainDomainService` added
- contracts: `IDomainFactory`/`IAsyncDomainFactory` are type-only so don't
  appear in `Object.keys(api)` snapshot (expected)

### Documentation

- `packages/aggregates/LLMGUIDE.md` — Entity entry in Key API
- `packages/domain-services/LLMGUIDE.md` — PlainDomainService at top
- `packages/contracts/LLMGUIDE.md` — IDomainFactory + IAsyncDomainFactory

### Verification

- `pnpm type-check` → 20 projects clean
- `pnpm test:ci` → 23 projects, all passing (after snapshot update)
- Zero breaking changes — pure additions only
- All deliverables behind public API barrels with @public + @stable JSDoc

### Naming decision

The agent recommendation said "bare `DomainService` class" but the name
`DomainService` was already taken by the auto-discovery decorator function.
Renaming the decorator would be a breaking API change. Chose
`PlainDomainService` instead — clear "no infrastructure" intent, no collision.
Trade-off: slightly less idiomatic than `DomainService`, but zero churn for
existing consumers.

Effort: 1h actual vs 8h estimated.

## Why This Task Exists

DDD compliance audit (2026-05-08) identified three canonical patterns that
competing libraries (NestJS DDD plugins, MikroORM-DDD, dddsample-java) ship
out-of-the-box but @vytches/ddd does not:

### 1. `Entity` base class (separate from `AggregateRoot`)

Evans Blue Book explicitly distinguishes `Entity` (identity, but not transaction
root) from `AggregateRoot`. Today consumers must roll their own internal-entity
base class.

**Rec**: `abstract class Entity<TId>` with `equals(other: Entity<TId>)`
comparing via `EntityId`. Export from `@vytches/ddd-aggregates` or move to
`@vytches/ddd-domain-primitives`.

### 2. `DomainService` (plain abstract class, no DI dependency)

Currently provided as `@DomainService()` decorator + `AsyncDomainService` /
`EventAwareDomainService`. Missing: minimal `abstract class DomainService` for
users not running DI containers.

**Rec**: extract bare `DomainService` to `@vytches/ddd-domain-services`,
independent from decorators.

### 3. `IDomainFactory<TAggregate, TProps>`

Evans treats `Factory` as first-class tactical pattern equal to `Repository` and
`AggregateRoot`. Library has factory-method support inside aggregates but no
reusable interface for consumers.

**Rec**: add `IDomainFactory<TAggregate, TProps>` to `@vytches/ddd-contracts`
alongside `IRepository`.

## Why Post-Release

Adding these is non-breaking (pure additions). Easier to do once API surface is
stable post-v0.25, with feedback from real consumers about naming preferences.

## Acceptance Criteria

- [ ] `Entity<TId>` exported with `equals()` method, deep-equality test
- [ ] Bare `DomainService` abstract class exported (no DI dep)
- [ ] `IDomainFactory<T, P>` interface in contracts
- [ ] Each pattern: 2 examples + LLMGUIDE.md update + canonical-pattern test

## Coupled with

- REL-009 (`commit()` rename to `markEventsAsCommitted()` is canonical-naming
  fix) — consider scope expansion
- VD-003 (Domain Services examples) — bare `DomainService` enables non-DI
  examples
