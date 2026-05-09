# Changelog

All notable changes to `@vytches/ddd` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.25.0-beta.1] — 2026-05-09

**First public release on npmjs.org.** Prior versions (0.22.x – 0.24.x and an
internal "3.0" milestone) shipped on GitHub Packages — they remain available
there but are not maintained going forward.

### 🚨 Breaking changes

- **`EnhancedCommandBus` resilience defaults are now opt-in** (REL-009).
  Previously circuit breaker and retry activated unless explicitly disabled
  (`enabled !== false`). Now both require `enabled: true`. Retrying domain
  commands silently caused potential duplicate-execution bugs (orders created
  twice, double charges). Timeout strategy remains default-on as it does not
  affect idempotency. Migration:

  ```ts
  // Before:
  new EnhancedCommandBus(container); // retry was on
  // After (if you actually want retry):
  new EnhancedCommandBus(container, {
    resilience: { retry: { enabled: true, maxAttempts: 3 } },
  });
  ```

- **`IAggregateSnapshot.aggregateId` is now `string`** (was `unknown`, REL-009).
  Implementation already produced strings; type just made consumers cast. A
  divergent dead-duplicate of the interface was removed from
  `packages/aggregates/src/aggregate-interfaces.ts` — the canonical definition
  lives in `@vytches/ddd-contracts`.

- **`Result<T, E>` has moved to `@vytches/ddd-contracts`** (REL-008). Existing
  `import { Result } from '@vytches/ddd-utils'` continues to work via a
  re-export shim. New code should import from `@vytches/ddd-contracts` directly.

- **`@internal` symbols removed from the curated public surface** (REL-005):
  `EVENT_HANDLER_METADATA`, `EVENT_HANDLER_OPTIONS`, `CUSTOM_MIDDLEWARE_SYMBOL`
  are no longer re-exported by the `@vytches/ddd` meta-package. They remain
  accessible via direct sub-package imports (`@vytches/ddd-contracts`,
  `@vytches/ddd-events`) for framework integrations only.

### ⚠️ Deprecations (will be removed in 1.0.0)

- **`EntityIdFactory`** and all its static methods (`createWithRandomUUID`,
  `fromUUID`, `fromInteger`, `fromBigInt`, `fromText`) now emit a one-time
  runtime `console.warn` per call site. Migrate to `EntityId.create()` /
  `EntityId.fromUUID()` etc. directly. Hard removal targeted for `v1.0.0` after
  community feedback (REL-005).

### 🐛 Bug fixes

- **`BaseRepository.save()` now calls `aggregate.commit()`** after dispatch
  (REL-009). Previously the same events would re-dispatch on every subsequent
  `save()`. Silent because most code paths call `save()` once per command.
- **`OrPolicyComposer` now aggregates all sub-violations** instead of returning
  only the first (REL-009). Failure result includes `details.violations[]` with
  `policyId`, `code`, `message`, `field` per failed branch.
- **`CommandBus.getHandlerToken` now throws `CQRSConfigurationError`** (was
  generic `Error`) for missing decorator metadata, matching `QueryBus` behavior
  (REL-009).

### 🔒 Security

- **`deserializeIntegrationEvent` utility now sanitizes** input — was raw
  `JSON.parse` with no size limit, no prototype-pollution protection, no
  recursion-depth limit (REL-007). Now uses the same `safeParseIntegrationJson`
  helper as the class-based `deserialize()`: 1 MB hard cap, 50-level depth
  limit, and `__proto__/constructor/prototype` key stripping.
- **`sanitizeIntegrationPayload` is now bounded** at 50 levels of recursion
  (REL-007). Previously unbounded — adversarial payloads could cause stack
  overflow.
- **1 MB size cap is enforced on actual UTF-8 byte length** (REL-007), not
  UTF-16 code-unit count. Previously a string of 1M code units could contain up
  to 4 MB of multi-byte content.
- **`AggregateRoot.maxEvents` advisory limit** (optional, default undefined for
  backward compat) — guards against runaway loops or malicious replay (REL-007).
- **AI SDK peer dependencies removed** from `@vytches/ddd-testing`
  (`@anthropic-ai/sdk`, `openai`) — they were declared but never imported in
  source. Removes spurious npm install warnings (REL-007).
- **`validation.rules.pattern` JSDoc** now warns explicitly against ReDoS via
  consumer-controlled RegExp construction (REL-007).
- **`.env.development` removed from git tracking** (REL-007). History audited —
  file was always 0 bytes, no secrets ever committed.

### ⚡ Performance

Three zero-risk runtime optimizations (no API changes, VP-NEW-001):

- **`BaseEventBus.publish()` early shortcircuit** — skips middleware pipeline
  entirely when no handlers are registered.
- **`CQRSDiscoveryPlugin.scanModule()` memoized** via WeakMap — repeat scans of
  the same module reference are O(1).
- **`EnhancedQueryBus.getCacheKey()` uses FNV-1a 32-bit hash** instead of
  `JSON.stringify(query)` — ~5-10× faster on the cache lookup hot path.

Baselines published in `benchmarks/baseline.json` (Node 22, dev hardware): 1.58M
`apply()`/sec, 8.35M `EntityId.create()`/sec, 15.7M `isValidUUID()`/sec.

### 📚 Documentation

- **README rewritten** from 1362 lines to 199 lines (REL-006). Removed
  references to non-existent packages (`@vytches/ddd-event-store`,
  `@vytches/ddd-core`, `@vytches/ddd-cli`) and to the deprecated CLI. Added
  explicit "Design Decisions" section explaining no-sagas / no-adapters /
  dependency-free / framework-agnostic stance.
- **QUICK_START.md** cleaned (REL-006): removed `npx @vytches/ddd init-context`
  reference (CLI was deprecated), added required tsconfig flags, AI-Assisted
  Development section.
- **`LLMGUIDE.md` shipped in all 20 packages** (REL-001) — per-package
  AI-assistant onboarding documents.
- **3 example workspaces** (REL-006 / VD-002 / VD-003):
  - `examples/quickstart/` — full Order domain (16 tests)
  - `examples/policies/` — 8 policy patterns (17 tests)
  - `examples/domain-services/` — 7 service patterns (17 tests)
- **Performance benchmarks** in `benchmarks/` with committed baseline
  (`pnpm bench`).

### 🛠️ Tooling

- **LLM-first DX** (REL-010): three new scripts
  - `pnpm llm:bundle` — generate full library context for AI assistants
  - `pnpm llm:verify` — drift detector for `docs/llm-context.md`
  - `pnpm llm:guides:check` — gate ensuring every package ships `LLMGUIDE.md`.
    Added to `prerelease`.
- **20 API surface snapshot tests** added in REL-005
  (`packages/*/tests/api-surface.test.ts`) — locks public API; future changes
  require explicit `vitest -u` acceptance.
- **Test stabilization** (VT-001 subset):
  - 2 flaky timer tests fixed via `vi.useFakeTimers`
  - 5 `describe.skip` blocks converted to `describe.todo`
  - removed flaky `toBeGreaterThan(0.5ms)` assertions
- **`Nx` project graph repaired** (REL-002) — `.claude/worktrees/` exclusion +
  empty `packages/cli/` cleanup. Fixes `MultipleProjectsWithSameNameError`.
- **Foundation purity restored** (REL-008): `@vytches/ddd-contracts` has zero
  workspace dependencies. `Result<T, E>` moved here from `@vytches/ddd-utils`.

### 📦 Distribution

- Published to **public npmjs.org** (was GitHub Packages, REL-003 / REL-011).
  Old versions remain on GH Packages as legacy archive but receive no updates.
  `npm install @vytches/ddd` no longer requires a `$GITHUB_TOKEN`.
- All 20 packages aligned to `0.25.0-beta.1` (REL-004 — were 0.22.x–0.24.5 with
  `@vytches/ddd-nestjs` incorrectly at `12.1.2`).

### 🧹 Removed

- `@vytches/ddd-cli` package (already deleted by VF-013; this release cleans the
  empty skeleton + dead `cli:*`, `docs:*`, `playground*` scripts from root
  `package.json`). Replaced by AI-assisted scaffolding via `LLMGUIDE.md` files.
- 11 dead/redundant `export *` wildcards across `di`, `domain-services`,
  `aggregates`, `testing/seeder` barrels (REL-005 / VP-005). Surface tests now
  lock the public API; remaining wildcards in `enterprise` and a few sub-paths
  are protected by snapshots.

---

## [3.0.0] - 2026-01-25 (internal — pre-public)

### 🚨 BREAKING CHANGES

#### Event Property Rename: `eventType` → `eventName`

**Motivation:** Improved naming consistency and clarity across the entire event
system.

**What Changed:**

- All event interfaces (`IDomainEvent`, `IIntegrationEvent`, `IAuditEvent`) now
  use `eventName` instead of `eventType`
- All event base classes (`DomainEvent`, `IntegrationEvent`) updated to use
  `eventName`
- All internal event handling logic updated to use `eventName`

**Migration Required:** Yes - Simple search & replace in your codebase

**Migration Guide:** See [MIGRATION_GUIDE_v3.md](./MIGRATION_GUIDE_v3.md)

**Affected Packages:**

- `@vytches/ddd-contracts` - Core event interfaces
- `@vytches/ddd-events` - Event implementations and utilities
- `@vytches/ddd-aggregates` - Aggregate event handling
- `@vytches/ddd-cqrs` - Command/Query event integration
- `@vytches/ddd-messaging` - Saga event processing
- `@vytches/ddd-event-store` - Event persistence
- `@vytches/ddd-projections` - Event projections
- All other packages using events

### Changed

- **contracts**: `IDomainEvent.eventType` → `IDomainEvent.eventName`
- **events**: `DomainEvent.eventType` → `DomainEvent.eventName`
- **events**: `IntegrationEvent.eventType` → `IntegrationEvent.eventName`
- **events**: `IAuditEvent.eventType` → `IAuditEvent.eventName`
- **events**: All event handler methods updated to use `eventName`
- **events**: Event serialization now uses `eventName` field
- **events**: Base event bus methods renamed parameter from `eventType` to
  `eventName`

### Fixed

- **events**: Variable shadowing conflicts in `BaseEventBus` methods resolved
- **events**: Consistent naming across all event types (domain, integration,
  audit)

### Documentation

- **Added**: Comprehensive migration guide (MIGRATION_GUIDE_v3.md)
- **Updated**: All README files to use `eventName`
- **Updated**: All code examples to use `eventName`
- **Updated**: HOW-TO guides to use `eventName`

### Tests

- **Updated**: All test files to use `eventName`
- **Verified**: 49/49 tests passing after migration
- **Added**: Test coverage for new `eventName` property

---

## [2.x] - Previous Releases

For changes in v2.x releases, please refer to individual package CHANGELOG files
or git history.

---

## Migration Support

- **v2.x Support Period:** Until 2026-06-30
- **Migration Guide:** [MIGRATION_GUIDE_v3.md](./MIGRATION_GUIDE_v3.md)
- **Issues:** https://github.com/vytches/ddd/issues
- **Documentation:** https://docs.vytches.com/ddd
