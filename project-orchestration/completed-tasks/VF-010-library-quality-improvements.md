# Task: Library Quality — Remaining Debt Items

## Task Metadata

```yaml
task_id: 2026-01-30-010
title: Resolve remaining technical debt items verified on 2026-04-03
type: refactor
priority: normal
complexity: medium
estimated_time: 6h
created_by: agent
created_at: 2026-01-30 14:00
status: cancelled
updated_at: 2026-04-03
cancelled_reason:
  Remaining items are busywork — no consumer impact, no publish blocker
```

## Domain Context

```yaml
bounded_context: LibraryQuality
aggregates:
  - AggregateRoot
entities:
  - Entity
value_objects:
  - EntityId
  - Result
domain_events: []
patterns:
  - Type Safety
  - Result Pattern
  - Factory Pattern
```

## Business Context

### Why This Task Exists

Tech-debt audit on 2026-04-03 verified the original VF-010 (80h, 8 sub-tasks)
against the actual codebase. Result: **6 of 8 sub-tasks are resolved or
intentional by design**. This task tracks only the verified remaining work.

### Original vs Verified State

| Original Claim              | Actual (2026-04-03)                        | Status                        |
| --------------------------- | ------------------------------------------ | ----------------------------- |
| 531 `any` types             | ~100 remain, nearly all intentional        | RESOLVED — see note below     |
| `getPreviousState(): any`   | Intentional DX choice                      | RESOLVED — `any` correct here |
| Seeder stubs typed `any`    | Intentional for test flexibility           | RESOLVED — `any` correct here |
| 522 `console.log`           | 4 remaining in testing pkg                 | RESOLVED                      |
| Unknown TODO/FIXME          | 0 remaining                                | RESOLVED                      |
| 8 mixed factory patterns    | Convention applied, old names deprecated   | RESOLVED                      |
| EntityIdFactory redundant   | Deprecated with @deprecated JSDoc          | Deferred to next major        |
| Result pattern inconsistent | Dual API (throw + tryFrom\*) is deliberate | RESOLVED — by design          |

### Note on `any` Types

Deep audit confirmed that `any` usage in this library is **intentional and
necessary**:

- `new (...args: any[]) => T` — Standard TypeScript pattern (29 instances), same
  as built-in `InstanceType`
- `Record<string, any>` — Metadata/context bags that must accept arbitrary data
- Decorator signatures — TypeScript limitation, cannot be more specific
- ACL `domainModel: any` — Domain-agnostic by design
- Test seeders — Must generate arbitrary types, `unknown` would kill usability
- `getPreviousState(): any` — Audit interface for any aggregate state, `unknown`
  forces unnecessary type narrowing on every consumer read

Replacing these with `unknown` would make the library unusable without constant
type assertions. The current `any` usage is the correct DX trade-off.

### Expected Business Value

- [ ] Consistent error handling via domain error types in EntityId
- [ ] Documented conventions for contributors
- [ ] Publication-ready code quality

### Success Metrics

- Base EntityId uses domain error types, not raw `throw new Error()`
- CONVENTIONS.md exists with factory/constructor patterns documented

## Technical Context

### Remaining Items

#### Item A: Raw throws in base EntityId (D-001, Major)

**Location**: `packages/contracts/src/domain/entity-id.implementation.ts` lines
142-182 **Problem**: 7x `throw new Error(...)` without domain error types
**Fix**: Replace with domain-specific error types (try\* Result variants already
exist as the safe alternative) **Effort**: 2h

#### Item B: Constructor pattern documentation (D-006, Minor)

**Problem**: No CONVENTIONS.md documenting:

- `create/from*/tryFrom*` factory naming convention
- Private constructor exception for base classes (AggregateRoot, EntityId)
- Intentional `any` patterns and why they exist **Effort**: 1h

#### Item C: Logger architecture review (Informational)

**Location**: `packages/aggregates/src/core/aggregate-utilities.ts` **Problem**:
Imports `@vytches/ddd-logging` — forces dependency on consumers **Decision
needed**: Make Logger optional/pluggable or accept the coupling **Effort**: 1h
decision + 3h if refactor

#### Item D: Testing console cleanup (D-003, Minor)

**Location**: `packages/testing/src/` **Problems**:

- `test-harness.ts:274` — `console.log` (should use Logger or remove)
- `seeder/` — 3x `console.warn` in fallback paths **Effort**: 30min

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] EntityId validation errors use domain error types
- [ ] CONVENTIONS.md created with factory + constructor + `any` justification
- [ ] Testing package: no console.\* in src

### Non-Functional Requirements

- [ ] Performance: No impact
- [ ] Security: No new vulnerabilities
- [ ] Documentation: CONVENTIONS.md
- [ ] Testing: Existing tests pass, new tests for error types

### Definition of Done

- [ ] Items A-D addressed (C is decision only)
- [ ] All tests passing
- [ ] CONVENTIONS.md reviewed

## Agent Assignments

```yaml
lead_agent: library-expert
supporting_agents:
  - agent: library-api-guardian
    role: Verify EntityId error type changes are backward-compatible
    deliverables: API compatibility report
collaboration_points:
  - Item A may affect EntityId consumers (error type changes)
```

## Implementation Plan

### Phase 1: EntityId Error Types (Item A) — 2h

- **Agent**: library-expert
- **Tasks**:
  - [ ] Replace 7x raw throws in EntityId with domain error types
  - [ ] Keep throwing behavior (not breaking), change Error subclass only
  - [ ] Verify backward compatibility
  - [ ] Update/add tests
- **Output**: Clean EntityId error handling

### Phase 2: Documentation (Item B) — 1h

- **Agent**: library-expert
- **Tasks**:
  - [ ] Create CONVENTIONS.md with factory naming convention
  - [ ] Document constructor pattern + base class exceptions
  - [ ] Document intentional `any` patterns with rationale
- **Output**: CONVENTIONS.md

### Phase 3: Logger Decision (Item C) — 1h

- **Agent**: architecture-guardian
- **Tasks**:
  - [ ] Review Logger coupling in aggregates core
  - [ ] Recommend: keep, make optional, or remove
- **Output**: ADR or decision note

### Phase 4: Testing Console Cleanup (Item D) — 30min

- **Agent**: library-expert
- **Tasks**:
  - [ ] Remove/replace 4x console.\* calls in testing/src/
- **Output**: Clean testing package

## Progress Tracking

### Current Status

```yaml
overall_progress: 0%
current_phase: planning
blockers: []
last_updated: 2026-04-03 13:00
```

### Activity Log

| Date       | Agent     | Action                      | Result                                                             |
| ---------- | --------- | --------------------------- | ------------------------------------------------------------------ |
| 2026-01-30 | tech-lead | Task created (original 80h) | 8 sub-tasks planned                                                |
| 2026-04-03 | tech-lead | Tech-debt audit             | 5/8 sub-tasks resolved, rewritten to 12h                           |
| 2026-04-03 | tech-lead | Deep `any` audit            | Confirmed most `any` intentional. Removed Items B+E. Reduced to 6h |

## Code References

### Files to Modify

```yaml
packages:
  - package: '@vytches/ddd-contracts'
    files:
      - src/domain/entity-id.implementation.ts (Item A)
  - package: '@vytches/ddd-testing'
    files:
      - src/core/test-harness.ts (Item D)
      - src/seeder/*.ts (Item D — console.warn only)
  - package: '@vytches/ddd-aggregates'
    files:
      - src/core/aggregate-utilities.ts (Item C — review only)
docs:
  - CONVENTIONS.md (Item B — new file)
```

## Risk Assessment

### Technical Risks

| Risk                                        | Probability | Impact | Mitigation                                         |
| ------------------------------------------- | ----------- | ------ | -------------------------------------------------- |
| EntityId error type change breaks consumers | Medium      | Medium | Keep throwing behavior, change Error subclass only |

## Testing Strategy

### Unit Tests

- [ ] EntityId validation: verify domain error types thrown
- [ ] Backward compatibility: existing error catches still work

## Documentation Updates

### Files to Create

- [ ] CONVENTIONS.md — factory naming, constructor patterns, intentional `any`
      rationale

---

_Task managed by Project Orchestrator | Last AI Review: 2026-04-03_ _Rewritten
from original 80h/8-subtask version. Deep any audit confirmed most any types
intentional._
