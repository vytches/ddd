# Task: DDD Compliance Validation Tools

## Task Metadata

```yaml
task_id: VF-001
title: Automated DDD compliance validation (rule engine + scoring)
type: feature
priority: normal
complexity: expert
estimated_time: 24h
actual_time: ~1h so far (MVP CLI + 3 rules + tests)
created_by: human (work-items archive 2026-03-31)
created_at: 2026-03-31
migrated_at: 2026-05-08
updated_at: 2026-05-09
status: in_progress
release_target: post-v0.25 (v0.26 or v0.27)
priority_score: 82/100
```

## Why This Task Exists

Library lacks automated DDD compliance validation: no aggregate boundary
validation, no repository pattern compliance, no ubiquitous language consistency
check, no dependency flow validation, no event naming convention validation, no
compliance scoring system.

## Why Post-Release

24h is half the release runway. Better to ship v0.25 as a usable library, then
add validation tooling as a follow-up — consumers can adopt the library without
it.

## Original Objectives (preserved + amended)

1. [ ] Compliance rule engine — **partial** (3 rules + dispatch via runner)
2. [x] Aggregate boundary validation — DONE (rule `ddd-001`)
3. [ ] Repository pattern compliance checks — not addressed
4. [ ] Ubiquitous language validator — not addressed
5. [ ] Compliance scoring system — not addressed (CLI returns flat issue list)
6. [x] CI integration for architecture review automation — DONE
       (`pnpm ddd:lint` + exit codes; staged adoption documented in README)

## MVP delivery (2026-05-09)

Shipped on `develop` (commit `8ff9a9a2`). New workspace project at
`tools/ddd-lint/` (private, `@vytches/ddd-lint`, not published to npm).

**3 rules** (AST walker via `typescript` package, no type checker):

- **`ddd-001`** (error/warning) — `no-mutable-state-in-aggregate`. Flags
  public/protected/bare mutable property declarations on `AggregateRoot` or
  `Entity` subclasses. Private (non-readonly) downgraded to warning per
  ddd-patterns-expert review (event handlers legitimately reassign).
- **`ddd-002`** (error) — `no-throw-in-domain`. Flags `throw` statements in
  files under `/domain/`, `/aggregates/`, `/value-objects/`, `/specifications/`,
  `/policies/`. Skips `/tests/`, `/__tests__/`, and colocated
  `*.test.ts`/`*.spec.ts`.
- **`ddd-003`** (warning) — `factory-must-return-result`. Flags static
  `create()` methods without `Result<T, E>` or `Promise<Result<...>>` return
  type. Per-file suppression via
  `// ddd-lint-disable factory-must-return-result`.

**CLI**: `pnpm ddd:lint [path]` (root script via tsx). Exit 0 (clean), 1
(errors), 2 (invalid args). Scans 458 files in ~200ms.

**29 tests** — per-rule unit tests + end-to-end runner tests with temp
directories.

**Real-world dogfooding**: surfaces 12 errors + 46 warnings on `packages/` —
actionable baseline for staged adoption (informational → blocking-soon →
blocking, documented in `tools/ddd-lint/README.md`).

Verification: ddd-patterns-expert — APPROVE_WITH_FIXES, all 2 required fixes
applied (private-non-readonly downgraded to warning, isDomainFile excludes
colocated test files). Suggestion to add ddd-004 (no-public-setter-in-aggregate)
noted for future task.

## Remaining scope (post-2026-05-09)

- More rules toward objectives 3, 4, 5:
  - Repository pattern compliance (e.g., no domain logic in `findById`)
  - Ubiquitous language validator (consistent vocabulary across files)
  - Compliance scoring (aggregate violations into a 0-100 health score)
  - `ddd-004` no-public-setter-in-aggregate (suggested by review)
- Integration tests against real `packages/` codebase — guard rule output
  against regressions
- Make blocking gate when error count on `packages/` reaches < 5
- Optional: publish as standalone `@vytches/ddd-lint` after stabilization
