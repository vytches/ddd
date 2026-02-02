# Task: Library Quality Improvements - Comprehensive Refactor

## Task Metadata

```yaml
task_id: 2026-01-30-010
title:
  Comprehensive library quality improvements (type safety, patterns, logging,
  conventions)
type: refactor
priority: high
complexity: expert
estimated_time: 80h
created_by: agent
created_at: 2026-01-30 14:00
status: planned
```

## Overview

This task consolidates 8 related quality improvements into a single coordinated
effort:

| #   | Improvement                              | Priority | Complexity | Est. Time |
| --- | ---------------------------------------- | -------- | ---------- | --------- |
| 1   | Eliminate `any` types from core packages | high     | complex    | 16h       |
| 2   | Standardize Result<T, Error> pattern     | high     | complex    | 24h       |
| 3   | Add Logger integration to all packages   | high     | medium     | 8h        |
| 4   | Migrate console.log to Logger            | normal   | medium     | 6h        |
| 5   | Standardize factory method naming        | normal   | medium     | 8h        |
| 6   | Remove redundant EntityIdFactory         | normal   | simple     | 2h        |
| 7   | Resolve TODO/FIXME comments              | normal   | medium     | 12h       |
| 8   | Standardize constructor patterns         | normal   | complex    | 16h       |

**Dependencies:**

- Task 4 depends on Task 3 (Logger must be integrated first)
- Task 6 depends on Task 5 (naming convention must be defined first)

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
  - Structured Logging
  - Static Factory Methods
```

## Business Context

### Why This Task Exists

Current codebase issues:

- **531 `any` types** - undermines TypeScript benefits
- **522 console.log calls** - no structured logging in production
- **Inconsistent error handling** - mix of throw/Result/raw returns
- **Inconsistent factory methods** - 8+ different naming patterns in EntityId
  alone
- **Redundant code** - EntityIdFactory duplicates EntityId static methods
- **Technical debt** - unresolved TODO/FIXME comments
- **Mixed constructor patterns** - public vs private + factory

### Expected Business Value

- [ ] Enterprise-grade type safety
- [ ] Production-ready observability
- [ ] Predictable, consistent API
- [ ] Reduced maintenance burden
- [ ] Professional library quality

### Success Metrics

- Zero `any` types in core packages (or documented exceptions)
- Zero console.log in library code
- 100% Result pattern for fallible operations
- Single naming convention for factories
- Zero untracked TODO/FIXME comments

---

## Task 1: Eliminate `any` Types

### Current State

- 531 `any` usages across 148 files
- Core packages should be type-safe foundation

### Target

- Zero `any` in contracts, domain-primitives, repositories
- Use generics, `unknown`, or proper types

### Acceptance Criteria

- [ ] Audit all `any` in target packages
- [ ] Replace with proper types/generics
- [ ] Document legitimate exceptions
- [ ] All tests passing

### Files to Modify

```yaml
packages:
  - '@vytches/ddd-contracts': src/**/*.ts
  - '@vytches/ddd-domain-primitives': src/**/*.ts
  - '@vytches/ddd-repositories': src/**/*.ts
```

---

## Task 2: Standardize Result Pattern

### Current State

- Mixed: throw exceptions / Result<T,E> / raw values
- Inconsistent error handling across packages

### Target

- All fallible operations return `Result<T, Error>`
- Exceptions only for truly exceptional situations
- `safeRun` pattern in all tests

### Acceptance Criteria

- [ ] Document error handling guidelines
- [ ] Convert core packages to Result pattern
- [ ] Migrate all tests to safeRun
- [ ] Create migration guide

### Files to Modify

```yaml
packages:
  - '@vytches/ddd-utils': src/result/**/*.ts (enhancements)
  - '@vytches/ddd-domain-primitives': src/**/*.ts
  - '@vytches/ddd-value-objects': src/**/*.ts
  - 'all': tests/**/*.test.ts (safeRun migration)
```

---

## Task 3: Logger Integration

### Current State

- `@vytches/ddd-logging` exists but not all packages use it
- No consistent correlation tracking

### Target

- All packages have Logger integration
- Correlation IDs propagate through operations
- Context-aware logging (DDD context)

### Acceptance Criteria

- [ ] Add Logger to domain-primitives
- [ ] Add Logger to value-objects
- [ ] Add Logger to repositories
- [ ] Add Logger to aggregates
- [ ] Implement correlation propagation

### Files to Modify

```yaml
packages:
  - '@vytches/ddd-domain-primitives': src/**/*.ts
  - '@vytches/ddd-value-objects': src/**/*.ts
  - '@vytches/ddd-repositories': src/**/*.ts
  - '@vytches/ddd-aggregates': src/**/*.ts
```

---

## Task 4: Migrate console.log to Logger

**⚠️ DEPENDS ON: Task 3**

### Current State

- 522 console.log/warn/error calls
- No structured output, no correlation

### Target

- Zero console.\* in library packages
- ESLint rule preventing future usage

### Acceptance Criteria

- [ ] Replace all console.log → Logger.debug/info
- [ ] Replace all console.warn → Logger.warn
- [ ] Replace all console.error → Logger.error
- [ ] Add ESLint no-console rule for src/

### Files to Modify

```yaml
packages:
  - 'all': src/**/*.ts
config:
  - .eslintrc.json
```

---

## Task 5: Standardize Factory Naming

### Current State

EntityId has 8 factory methods with mixed naming:

- `create*`: createWithRandomUUID, createText, createUuid, createInteger,
  createBigInt
- `from*`: fromUUID, fromText, fromInteger, fromBigInt

### Target Convention

```typescript
create(); // Primary factory for new instances
from * source; // Conversion from other types
of(value); // Wrapping a primitive
empty(); // Null/empty instance
```

### Acceptance Criteria

- [ ] Document naming convention in CONVENTIONS.md
- [ ] Audit all factory methods
- [ ] Rename/consolidate to follow convention
- [ ] Add deprecation warnings for old names

### Files to Modify

```yaml
packages:
  - '@vytches/ddd-contracts': src/domain/entity-id.implementation.ts
  - '@vytches/ddd-value-objects': src/**/*.ts
  - '@vytches/ddd-aggregates': src/**/*.ts
docs:
  - CONVENTIONS.md (new)
```

---

## Task 6: Remove EntityIdFactory

**⚠️ DEPENDS ON: Task 5**

### Current State

```typescript
// 100% redundant wrapper
class EntityIdFactory {
  static uuid() {
    return EntityId.createWithRandomUUID();
  }
  static fromText(t) {
    return EntityId.fromText(t);
  }
  // ...
}
```

### Target

- Deprecate EntityIdFactory
- All code uses EntityId static methods directly
- Remove in next major version

### Acceptance Criteria

- [ ] Add @deprecated to all EntityIdFactory methods
- [ ] Update internal usages to EntityId
- [ ] Document migration path
- [ ] Plan removal timeline

### Files to Modify

```yaml
packages:
  - '@vytches/ddd-value-objects': src/id.value-object.ts
```

---

## Task 7: Resolve TODO/FIXME Comments

### Current State

- Unknown count of TODO/FIXME comments
- Hidden technical debt

### Target

- All resolved or tracked as separate tasks
- Zero untracked comments

### Acceptance Criteria

- [ ] Grep all TODO/FIXME
- [ ] Classify: quick-fix / task-needed / outdated
- [ ] Fix quick items
- [ ] Create tasks for complex items
- [ ] Remove outdated comments

### Files to Modify

```yaml
packages:
  - 'all': src/**/*.ts
```

---

## Task 8: Standardize Constructor Patterns

### Current State

- Mixed public/private constructors
- Inconsistent validation at creation

### Target Pattern

```typescript
class Order extends AggregateRoot {
  private constructor(props: OrderProps) {
    super(props);
  }

  static create(data: CreateOrderData): Result<Order, ValidationError> {
    // Validation here
    return Result.ok(new Order(validated));
  }

  static reconstitute(props: OrderProps): Order {
    // No validation for persistence reconstitution
    return new Order(props);
  }
}
```

### Acceptance Criteria

- [ ] Document constructor convention
- [ ] Update value objects
- [ ] Update entities
- [ ] Update aggregates
- [ ] Provide create() and reconstitute() methods

### Files to Modify

```yaml
packages:
  - '@vytches/ddd-contracts': src/domain/*.ts
  - '@vytches/ddd-value-objects': src/**/*.ts
  - '@vytches/ddd-domain-primitives': src/entities/**/*.ts
  - '@vytches/ddd-aggregates': src/**/*.ts
```

---

## Implementation Plan

### Phase 1: Foundation (Tasks 1, 3)

Independent tasks that enable others.

- [ ] **Task 1**: Eliminate `any` types
- [ ] **Task 3**: Add Logger integration

### Phase 2: Dependent Cleanup (Tasks 4, 7)

Can proceed after Phase 1.

- [ ] **Task 4**: Migrate console to Logger (after Task 3)
- [ ] **Task 7**: Resolve TODO/FIXME

### Phase 3: Conventions (Tasks 5, 2)

Define and apply conventions.

- [ ] **Task 5**: Standardize factory naming
- [ ] **Task 2**: Standardize Result pattern

### Phase 4: Final Cleanup (Tasks 6, 8)

Apply remaining patterns.

- [ ] **Task 6**: Remove EntityIdFactory (after Task 5)
- [ ] **Task 8**: Standardize constructor patterns

---

## Progress Tracking

### Current Status

```yaml
overall_progress: 0%
current_phase: planning
blockers: []
last_updated: 2026-01-30 14:00
```

### Task Progress

| Task                    | Status  | Progress | Notes              |
| ----------------------- | ------- | -------- | ------------------ |
| 1. Eliminate `any`      | planned | 0%       |                    |
| 2. Result pattern       | planned | 0%       |                    |
| 3. Logger integration   | planned | 0%       |                    |
| 4. Console migration    | blocked | 0%       | Waiting for Task 3 |
| 5. Factory naming       | planned | 0%       |                    |
| 6. EntityIdFactory      | blocked | 0%       | Waiting for Task 5 |
| 7. TODO/FIXME           | planned | 0%       |                    |
| 8. Constructor patterns | planned | 0%       |                    |

### Activity Log

| Date       | Agent     | Action       | Result  |
| ---------- | --------- | ------------ | ------- |
| 2026-01-30 | Tech Lead | Task created | Planned |

---

## Risk Assessment

| Risk                 | Probability | Impact | Mitigation                          |
| -------------------- | ----------- | ------ | ----------------------------------- |
| Breaking API changes | High        | High   | Deprecation warnings, major version |
| Scope creep          | Medium      | Medium | Strict phase boundaries             |
| Incomplete migration | Medium      | Medium | Comprehensive audits                |
| Consumer code breaks | Medium      | High   | Migration guides                    |

---

## Testing Strategy

- [ ] All existing tests must pass after each task
- [ ] New tests for Result pattern usage
- [ ] safeRun migration in test files
- [ ] No regressions between phases

---

## Documentation Updates

- [ ] CONVENTIONS.md - factory naming, constructor patterns
- [ ] ERROR_HANDLING.md - Result pattern guidelines
- [ ] LOGGING.md - Logger usage guide
- [ ] MIGRATION.md - upgrade guide for consumers
- [ ] CHANGELOG.md - all changes documented

---

## Already Completed (This Session)

- ✅ **MiddlewarePipelineExecutor**: Created in `@vytches/ddd-utils`, refactored
  CQRS to use it
- ✅ **Contracts tests**: Added 97 tests (EntityId, CapabilityRegistry,
  Capability, createDomainEvent)

---

_Task managed by Project Orchestrator | Last AI Review: 2026-01-30_
