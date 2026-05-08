# Task: Add canonical DDD tactical patterns (Entity, DomainService, DomainFactory)

## Task Metadata

```yaml
task_id: VF-CANON-001
title: Bring tactical pattern catalog to canonical Evans/Vernon shape
type: feature
priority: normal
complexity: medium
estimated_time: 8h
created_by: agent (ddd-compliance-guardian 2026-05-08)
created_at: 2026-05-08
status: planned
release_target: post-v0.25 (v0.26)
```

## Why This Task Exists

DDD compliance audit (2026-05-08) identified three canonical patterns that
competing libraries (NestJS DDD plugins, MikroORM-DDD, dddsample-java) ship
out-of-the-box but @vytches/ddd does not:

### 1. `Entity` base class (separate from `AggregateRoot`)

Evans Blue Book explicitly distinguishes `Entity` (identity, but not
transaction root) from `AggregateRoot`. Today consumers must roll their own
internal-entity base class.

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

Evans treats `Factory` as first-class tactical pattern equal to `Repository`
and `AggregateRoot`. Library has factory-method support inside aggregates but
no reusable interface for consumers.

**Rec**: add `IDomainFactory<TAggregate, TProps>` to `@vytches/ddd-contracts`
alongside `IRepository`.

## Why Post-Release

Adding these is non-breaking (pure additions). Easier to do once API surface
is stable post-v0.25, with feedback from real consumers about naming
preferences.

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
