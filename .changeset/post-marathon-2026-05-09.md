---
'@vytches/ddd': minor
'@vytches/ddd-acl': minor
'@vytches/ddd-aggregates': minor
'@vytches/ddd-contracts': minor
'@vytches/ddd-cqrs': minor
'@vytches/ddd-di': minor
'@vytches/ddd-domain-primitives': minor
'@vytches/ddd-domain-services': minor
'@vytches/ddd-events': minor
'@vytches/ddd-logging': minor
'@vytches/ddd-messaging': minor
'@vytches/ddd-nestjs': minor
'@vytches/ddd-policies': minor
'@vytches/ddd-projections': minor
'@vytches/ddd-repositories': minor
'@vytches/ddd-resilience': minor
'@vytches/ddd-testing': minor
'@vytches/ddd-utils': minor
'@vytches/ddd-validation': minor
'@vytches/ddd-value-objects': minor
---

Post-release marathon (2026-05-09) — non-breaking additions across the library.

### Added

- **`Entity<TId>` abstract class** in `@vytches/ddd-aggregates` — canonical base
  for non-root domain entities (Evans/Vernon shape). Sibling to `AggregateRoot`
  (no inheritance change), identity-based equality.
- **`PlainDomainService` abstract class** in `@vytches/ddd-domain-services` —
  bare, infrastructure-free service base (only `serviceId`). Use when you don't
  need the lifecycle / event-bus / UoW machinery of the existing
  `IBaseDomainService` hierarchy.
- **`IDomainFactory<TAgg, TProps>` and `IAsyncDomainFactory`** in
  `@vytches/ddd-contracts` — factory pattern contract returning
  `Result<TAgg, Error>`. Sibling to `IRepository`.
- **`IBatchRepository<T>`** in `@vytches/ddd-contracts` — N+1 prevention
  contract. Extends `IExtendedRepository` with
  `findByIds(ids): Promise<Array<T | null>>` (order-preserving, null for
  misses). Adapter authors implement once via `WHERE id IN`, MGET, or
  DataLoader.
- **`MemoizedSpecification<T>`** in `@vytches/ddd-validation` — per-candidate
  `WeakMap<T, boolean>` cache for repeated `isSatisfiedBy` calls on the same
  candidate. `invalidate(c)` for manual eviction. Documented as per-query helper
  (not singleton-safe).
- **Property-based tests via fast-check** for `EntityId` (11 algebraic
  invariants) and `BaseValueObject` (14 properties).
- **Aggregate lifecycle test suite** (25 cases): `apply()` invariants,
  `commit()` semantics, `loadFromHistory` reconstitution, `maxEvents` guard,
  capability composition.
- **OutboxProcessor sequence tests** (11 cases).

### Changed

- **`AggregateRoot.apply()` performance refactor** — eliminated duplicate
  `Object.create` and double `sanitizeMetadata` in the
  object-event-with-metadata branch. Fast-path `sanitizeMetadata` returns input
  unchanged when no prototype-pollution keys are present.
  - Single-event apply: 1,578,919 → 1,640,055 ops/sec (+3.9%)
  - 100-event replay: 32,103 → 39,056 ops/sec (+21.7%, ~3.9M events/s)
  - Zero API change.
- **`AutoDiscoveryService` (NestJS) cold-start optimization** — replaced 5
  unconditional `Reflect.getMetadata` calls per provider with one
  `Reflect.getMetadataKeys` scan + targeted fetches. WeakSet memoization for
  multi-context apps. ~15-30ms cold-start savings on 10-context deployments.
  Public `reset()` method added for test isolation.
- **JSDoc enhancement** for 18 core public-API symbols across `aggregates`,
  `contracts`, `cqrs`, `events` packages — every TOP-20 symbol now has
  copy-paste-ready `@example` blocks for IDE hover.

### Fixed

- **`OutboxProcessor` destructure bug** — `outbox-processor.ts:104` destructured
  `safeRun` result as `[result, error]` instead of `[error, result]`. Caused
  `getUnprocessedMessages` results to be silently treated as errors, breaking
  outbox processing globally. Caught by new sequence tests.

### Tooling (not published, monorepo-only)

- **`tools/ddd-lint/`** — internal CLI flagging top 3 DDD anti-patterns (mutable
  state in aggregates, throws in domain layer, factories not returning
  `Result<T, E>`). 3 rules + file-level `// ddd-lint-disable` directive support.
  ~200ms full-repo scan. Documented adoption path: informational → blocking-soon
  → blocking. See `tools/ddd-lint/CONSUMER-USAGE.md` for running it in apps that
  consume `@vytches/ddd`.
- **`tools/consumer-llm-bundle/`** — pure-Node script aggregating `LLMGUIDE.md`
  from installed `@vytches/ddd-*` packages into a single AI-context bundle. Zero
  dependencies, supports pnpm/npm/yarn layouts. See
  `tools/consumer-llm-bundle/README.md`.

### Notes

This entry covers work shipped on `develop` between 2026-05-09 morning and
afternoon (commits `7e543207` through current HEAD). All changes non-breaking;
no public-API removals or renames. `pnpm ddd:lint` baseline on `packages/`: 0
errors, 49 warnings (down from 12/46 — fixed test fixture and added file-level
suppressions in two backward-compat factories with documented rationale).
