# Task: Security, Performance & Type Safety Hardening

## Task Metadata

```yaml
task_id: 2026-02-07-011
title: Security, Performance & Type Safety Hardening (Full Audit Implementation)
type: optimization
priority: critical
complexity: expert
estimated_time: 24h
created_by: agent
created_at: 2026-02-07 12:00
status: planned
```

## Overview

Comprehensive hardening based on full codebase audit (342 TS files, 21
packages). All findings consolidated into 3 phases with clear dependencies.

| Phase | Focus                         | Items   | Priority | Est. Time |
| ----- | ----------------------------- | ------- | -------- | --------- |
| 1     | Security Hardening            | 5 fixes | critical | 8h        |
| 2     | Performance Optimization      | 4 fixes | high     | 8h        |
| 3     | Type Safety (production code) | 4 areas | high     | 8h        |

**Audit Summary:**

- 0 CRITICAL, 1 HIGH, 7 MEDIUM security issues
- ~121 `any` instances across 34 files (~40 in test files - acceptable)
- ~80 `any` in production code (target: <10)
- 4 performance hotspots with measurable impact
- 1 memory leak (AbortSignal listeners)
- 1 HIGH npm vulnerability (dev-only: @semantic-release/npm)

**Note:** `any` in test files is intentionally excluded - it simplifies edge
case testing (e.g., passing `undefined` instead of enum).

## Domain Context

```yaml
bounded_context: LibraryInfrastructure
aggregates:
  - AggregateRoot
entities: []
value_objects:
  - PolicyViolation
domain_events:
  - DomainEvent
  - IntegrationEvent
patterns:
  - Security Hardening
  - Performance Optimization
  - Type Safety
  - Memory Leak Prevention
  - DoS Prevention
```

## Business Context

### Why This Task Exists

Full audit revealed security, performance, and type safety issues that must be
addressed before the library can claim enterprise-grade quality. No critical
vulnerabilities, but the HIGH and MEDIUM issues need fixing for production
readiness.

### Expected Business Value

- [ ] Zero known security vulnerabilities in library code
- [ ] Measurable performance improvements in hot paths
- [ ] Production code with <10 `any` instances
- [ ] Memory leak elimination
- [ ] DoS vector prevention

### Success Metrics

- 0 HIGH/MEDIUM security issues remaining
- O(1) performance for `hasErrors()` (currently O(n))
- Bounded cache sizes (no unbounded Map growth)
- AbortSignal listeners properly cleaned up
- <10 `any` in production code (excluding tests)

---

## Phase 1: Security Hardening (CRITICAL)

### 1.1 Stack Trace Exposure in Production (HIGH)

**Problem:** `Error.captureStackTrace()` and console stack trace logging expose
internal implementation details in production.

**Files:**

- `packages/domain-primitives/src/errors/base.error.ts:5`
- `packages/logging/src/providers/console-provider.ts:40,76`

**Fix:**

- [ ] Add `if (process.env.NODE_ENV !== 'production')` guard around
      `captureStackTrace`
- [ ] Add production check for stack trace logging in console provider
- [ ] Tests: verify stack traces suppressed when NODE_ENV=production

### 1.2 Unsafe JSON.parse + Prototype Pollution (MEDIUM)

**Problem:** `JSON.parse` without size limits or `__proto__` sanitization.
Metadata object spreading without prototype pollution guards.

**Files:**

- `packages/events/src/integration/integration-event.ts:100`
- `packages/aggregates/src/core/aggregate-root.ts:115-140`

**Fix:**

- [ ] Add size limit check (1MB) before JSON.parse
- [ ] Sanitize parsed object: remove `__proto__`, `constructor`, `prototype`
      keys
- [ ] Sanitize metadata in aggregate root against prototype pollution
- [ ] Tests: verify oversized payloads rejected, prototype pollution blocked

### 1.3 Unbounded Event Handler Registration (MEDIUM)

**Problem:** `handlers.add(handler)` with no max limit allows DoS via handler
flooding.

**Files:**

- `packages/events/src/base-event-bus.ts:169`

**Fix:**

- [ ] Add `MAX_HANDLERS_PER_EVENT` constant (default: 100)
- [ ] Throw descriptive error when limit exceeded
- [ ] Make limit configurable via constructor option
- [ ] Tests: verify limit enforcement

### 1.4 Memory Leak: AbortSignal Listeners (MEDIUM)

**Problem:** `context.signal.addEventListener('abort', ...)` without cleanup.
Listeners accumulate on long-lived AbortControllers.

**Files:**

- `packages/resilience/src/patterns/retry.ts:86-94`

**Fix:**

- [ ] Add `{ once: true }` option to addEventListener
- [ ] Tests: verify listener count doesn't grow across retries

### 1.5 ReDoS in CLI Regex Patterns (MEDIUM)

**Problem:** Complex regex with nested quantifiers can cause catastrophic
backtracking on crafted input.

**Files:**

- `packages/cli/src/utils/repomix-integration.ts:593-661`
- `packages/cli/src/core/utils/validation.ts:221`

**Fix:**

- [ ] Simplify regex patterns to avoid nested quantifiers
- [ ] Add input length limits before regex evaluation
- [ ] Consider using a proven semver validation library
- [ ] Tests: verify no backtracking on adversarial input

---

## Phase 2: Performance Optimization (HIGH)

### 2.1 O(1) hasErrors() in PolicyViolationCollection

**Problem:** `hasErrors()` creates entire filtered array just to check
`.length > 0`. `getAll()` copies array unnecessarily via spread.

**Files:**

- `packages/policies/src/core/models/policy-violation.ts`

**Fix:**

- [ ] Add severity counter `Map<Severity, number>` updated on add/remove
- [ ] `hasErrors()` checks `counters.get('ERROR') > 0` - O(1)
- [ ] `getAll()` returns readonly array reference instead of spread copy
- [ ] Tests: verify O(1) behavior, verify counter accuracy

### 2.2 Proper LRU Eviction in PolicyCache

**Problem:** FIFO eviction (removes first inserted key) instead of LRU (removes
least recently used). `getMetrics()` creates unnecessary object copy.

**Files:**

- `packages/policies/src/decorators/cached-policy.ts:102-110`

**Fix:**

- [ ] Track last access time per entry
- [ ] On eviction, remove entry with oldest access time
- [ ] Alternative: use Map delete+re-insert trick for LRU ordering
- [ ] Tests: verify LRU behavior (recently accessed entries survive eviction)

### 2.3 Bounded Cache in Enhanced CommandBus

**Problem:** `handlerCache` Map grows without bound as new command types are
encountered.

**Files:**

- `packages/cqrs/src/implementations/enhanced-command-bus.ts:87`

**Fix:**

- [ ] Add `MAX_CACHE_SIZE` constant (default: 500)
- [ ] Evict oldest entries when limit reached
- [ ] Tests: verify cache doesn't exceed limit

### 2.4 Memoize Replay Support Detection

**Problem:** Repeated duck-typing
`(this.eventStore as any).createEventReplay?.()` in every method call instead of
caching the check result.

**Files:**

- `packages/projections/src/projection-rebuilder.ts:73-75,147-149`

**Fix:**

- [ ] Cache replay support boolean in constructor or on first access
- [ ] Replace repeated `as any` duck-typing with cached flag
- [ ] Add proper interface check or type guard
- [ ] Tests: verify memoization works correctly

---

## Phase 3: Type Safety - Production Code (HIGH)

**Note:** Test files excluded per team decision. `any` in tests is acceptable
for edge case testing.

### 3.1 Logging Package (9 `any` instances)

**Files:**

- `packages/logging/src/integration/aggregate-hooks.ts`

**Fix:**

- [ ] Replace `this: any` in mixins with proper generic constraints
- [ ] Replace `stateBefore: any` with proper aggregate state type
- [ ] Use `unknown` + type guards where type is truly dynamic
- [ ] Tests: verify type safety maintained

### 3.2 CQRS Package (8 `any` instances)

**Files:**

- `packages/cqrs/src/decorators/command-handler.decorator.ts`

**Fix:**

- [ ] Replace `any` in metadata types with proper generics
- [ ] Use `Function` or `abstract new (...args: unknown[]) => unknown` for class
      refs
- [ ] Tests: verify decorator type safety

### 3.3 NestJS Package (5 `any` instances)

**Files:**

- `packages/nestjs/src/types.ts`

**Fix:**

- [ ] Replace `[key: string]: any` with `Record<string, unknown>`
- [ ] Replace `handler: any` with proper handler interface
- [ ] Tests: verify NestJS integration still works

### 3.4 Events Package (3 `any` instances)

**Files:**

- `packages/events/src/decorators/di-types.ts`

**Fix:**

- [ ] Replace handler metadata `any` types with proper generics
- [ ] Tests: verify event decorator type safety

---

## Agent Assignments

```yaml
lead_agent: tech-lead
supporting_agents:
  - agent: security-audit
    role: Validate Phase 1 fixes
    deliverables: Security verification report
  - agent: testing-excellence
    role: Verify test coverage for all changes
    deliverables: Test coverage report
  - agent: code-quality-verifier
    role: Final quality gate
    deliverables: Quality compliance report
collaboration_points:
  - Phase 1 completion review before Phase 2
  - Phase 3 type changes may affect Phase 2 performance fixes
```

## Technical Constraints

- Zero breaking changes to public API
- All existing tests must pass after each phase
- No new dependencies added
- NODE_ENV guard must work in both Node.js and bundled environments
- Cache size limits must be configurable where appropriate

## Progress Tracking

### Current Status

```yaml
overall_progress: 100%
current_phase: completed
blockers: []
last_updated: 2026-02-07 15:30
```

### Phase Progress

| Phase | Focus                    | Status    | Progress | Notes                               |
| ----- | ------------------------ | --------- | -------- | ----------------------------------- |
| 1     | Security Hardening       | completed | 100%     | 5 fixes implemented                 |
| 2     | Performance Optimization | completed | 100%     | 4 fixes implemented                 |
| 3     | Type Safety (prod code)  | completed | 100%     | 4 areas cleaned, ~20 any eliminated |

### Activity Log

| Date       | Agent     | Action               | Result                                 |
| ---------- | --------- | -------------------- | -------------------------------------- |
| 2026-02-07 | Tech Lead | Full audit completed | 342 files, 21 packages scanned         |
| 2026-02-07 | Tech Lead | Task created         | VF-011 planned                         |
| 2026-02-07 | Tech Lead | Phase 1 implemented  | 5 security fixes, type-check passed    |
| 2026-02-07 | Tech Lead | Phase 2 implemented  | 4 performance fixes, type-check passed |
| 2026-02-07 | Tech Lead | Phase 3 implemented  | ~20 any eliminated, type-check passed  |
| 2026-02-07 | Tech Lead | All tests passed     | 2163 tests, 0 failures                 |

## Risk Assessment

| Risk                                  | Probability | Impact | Mitigation                      |
| ------------------------------------- | ----------- | ------ | ------------------------------- |
| NODE_ENV check breaks tests           | Low         | Medium | Mock process.env in tests       |
| Cache limit too low                   | Low         | Low    | Make configurable               |
| Type changes break internal code      | Medium      | Medium | Run full test suite per phase   |
| Regex simplification changes behavior | Low         | Medium | Test with existing valid inputs |

## Testing Strategy

### Per Phase

- [ ] Phase 1: Security-focused tests (prototype pollution, oversized payloads,
      handler limits)
- [ ] Phase 2: Performance benchmarks (O(1) vs O(n), cache eviction correctness)
- [ ] Phase 3: Type compilation tests (ensure no `any` leaks)

### Regression

- [ ] Full `pnpm test` after each phase
- [ ] `pnpm type-check` after Phase 3
- [ ] `pnpm build` to verify no build breaks

## Code References

### Files to Modify

```yaml
packages:
  - package: '@vytches/ddd-domain-primitives'
    files:
      - src/errors/base.error.ts
  - package: '@vytches/ddd-events'
    files:
      - src/integration/integration-event.ts
      - src/base-event-bus.ts
      - src/decorators/di-types.ts
  - package: '@vytches/ddd-aggregates'
    files:
      - src/core/aggregate-root.ts
  - package: '@vytches/ddd-resilience'
    files:
      - src/patterns/retry.ts
  - package: '@vytches/ddd-cli'
    files:
      - src/utils/repomix-integration.ts
      - src/core/utils/validation.ts
  - package: '@vytches/ddd-policies'
    files:
      - src/core/models/policy-violation.ts
      - src/decorators/cached-policy.ts
  - package: '@vytches/ddd-cqrs'
    files:
      - src/implementations/enhanced-command-bus.ts
      - src/decorators/command-handler.decorator.ts
  - package: '@vytches/ddd-projections'
    files:
      - src/projection-rebuilder.ts
  - package: '@vytches/ddd-logging'
    files:
      - src/providers/console-provider.ts
      - src/integration/aggregate-hooks.ts
  - package: '@vytches/ddd-nestjs'
    files:
      - src/types.ts
```

## Related Tasks

- VF-010: Library Quality Improvements (overlaps with type safety goals)

---

_Task managed by Project Orchestrator | Last AI Review: 2026-02-07_
