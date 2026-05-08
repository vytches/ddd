# Task: Public API cleanup — remove leaks, finalize deprecations

## Task Metadata

```yaml
task_id: REL-005
title: Lock public API before v1.0 — remove @internal leaks, deprecated cruft, wildcard exports
type: refactor
priority: critical
complexity: complex
estimated_time: 12h
created_by: agent (library-api-guardian)
created_at: 2026-05-08 14:00
status: planned
release_target: v0.25.0-beta.1
```

## Why This Task Exists

Once published on public npm, every exported symbol is locked by semver. Three
classes of leaks must be sealed before publication:

1. `@internal` symbols re-exported by `enterprise`
2. Long-deprecated APIs awaiting "next major" — this *is* that major
3. Wildcard `export *` statements that auto-publish anything new

## Current State (specific findings)

### @internal leaks in `packages/enterprise/src/index.ts`

- Line 79: `EVENT_HANDLER_METADATA`
- Line 80: `EVENT_HANDLER_OPTIONS`
- Line 113: `CUSTOM_MIDDLEWARE_SYMBOL`

All three carry `@internal` JSDoc tag in their source packages.

### Deprecated awaiting removal — STAGED REMOVAL (revised 2026-05-08)

- `EntityIdFactory` class (entire class) in `packages/value-objects`
- `EntityId.new()` static method
- Both promise removal in "next major version"

**⚠️ Risk**: `juz-ide-api` (consumer with 237+ aggregates) very likely uses
`EntityIdFactory.createWithRandomUUID()` or similar. Hard removal in
`0.25.0-beta.1` would break the smoke test.

**Staged plan**:
1. **In v0.25.0-beta.1**: keep both, but escalate deprecation —
   - Add `@deprecated` runtime warning (`console.warn` once per process)
   - Document removal target: `1.0.0` (after beta consumer feedback)
   - Add migration recipe to CHANGELOG: `EntityIdFactory.createWithRandomUUID()`
     → `EntityId.create(LibUtils.getUUID())` (or similar)
2. **In v0.26 / 1.0.0** (post-smoke-test): hard-remove if `juz-ide-api`
   migration is verified.

This split protects the smoke test while still signaling the deprecation
publicly.

### Wildcard `export *` in barrels

- `packages/di/src/index.ts` — types, errors, service-locator
- `packages/domain-services/src/index.ts` lines 39–43
- `packages/testing/src/seeder/index.ts` (multiple)
- `packages/enterprise/src/index.ts` line 94 (`domain-primitives`)

### Name conflict risk

- `EntityId` exported by both `contracts` (as `BaseEntityId`) and `value-objects`
  (as `EntityId`). Untested via export tests — `domain-primitives` re-export
  via `*` could silently shadow.

## Desired State

- Zero `@internal` symbols in `enterprise/src/index.ts`
- `EntityIdFactory` and `EntityId.new()` deleted (BREAKING — document in CHANGELOG)
- All barrels use explicit named exports
- API surface tests assert exact export shape per package

## Acceptance Criteria

- [ ] `enterprise/src/index.ts`: 3 internal symbols removed OR `@internal` tag dropped + finalized
- [ ] `EntityIdFactory` and `EntityId.new()` get **runtime deprecation
      warnings** (not deletion); CHANGELOG documents migration recipe and
      v1.0 removal target
- [ ] All `export *` replaced with explicit `export { Foo, Bar, type Baz } from '...'`
      in: `di`, `domain-services`, `testing`, `enterprise` (the 4 remaining barrels)
- [ ] `packages/*/api-surface.test.ts` for every package, snapshot-asserting
      sorted list of exported names
- [ ] `pnpm test:contracts` passes (validates 21 surface snapshots)
- [ ] CHANGELOG `## [0.25.0-beta.1]` documents every removed symbol

## Why beta, not 1.0?

Three concrete API risks (internal leaks, deprecated cruft, name collisions)
mean we should not lock semver yet. Ship as `0.25.0-beta.1`, gather 2–4 weeks
of feedback from `juz-ide-api` (237+ aggregates), then promote to `1.0.0`.
