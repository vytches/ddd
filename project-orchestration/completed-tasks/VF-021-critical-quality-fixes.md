# Task: Critical Quality Fixes from Comprehensive Audit

## Task Metadata

```yaml
task_id: 2026-04-02-021
title:
  Critical quality fixes — type safety, concurrency, error handling,
  architecture cleanup
type: refactor
priority: critical
complexity: complex
estimated_time: 12h
created_by: human
created_at: 2026-04-02 10:00
status: completed
```

## Overview

Comprehensive audit (2026-04-02) identified 10 critical issues across type
safety, concurrency, error handling, architecture, and performance. All are
fixable without breaking changes. Ordered by production risk.

| #   | Category       | Problem                                                                                          | File                                                                | Severity |
| --- | -------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | -------- |
| 1   | Architecture   | js-yaml/gray-matter in utils dependencies — 14+ packages pull unnecessary deps                   | packages/utils/package.json                                         | CRITICAL |
| 2   | Architecture   | Dead tsconfig aliases to removed packages (cli, event-scheduling, event-store, process-managers) | tsconfig.base.json                                                  | MEDIUM   |
| 3   | Concurrency    | withAttempt() creates new AbortController without propagating parent abort                       | packages/resilience/src/core/resilience-context.ts:100-108          | HIGH     |
| 4   | Performance    | Bulkhead timeout setTimeout never cleared after resolve                                          | packages/resilience/src/patterns/bulkhead.ts:88-96                  | HIGH     |
| 5   | Type Safety    | Result.mapAsync() — `error as TError` unsafe cast without validation                             | packages/utils/src/result.ts:164                                    | HIGH     |
| 6   | Type Safety    | AuditCapability.attach() — double cast without runtime typeof check                              | packages/aggregates/src/capabilities/audit-capability.ts:23-28      | HIGH     |
| 7   | Error Handling | InvalidParameterError uses DomainErrorCode.MissingValue instead of InvalidParameter              | packages/domain-primitives/src/errors/domain.errors.ts:80           | MEDIUM   |
| 8   | Error Handling | VersioningCapability silently skips missing upcasters                                            | packages/aggregates/src/capabilities/versioning-capability.ts:57-73 | HIGH     |
| 9   | Immutability   | \_internal_setState() assigns array by reference — caller can mutate                             | packages/aggregates/src/core/aggregate-root.ts:267-275              | HIGH     |
| 10  | Performance    | Metric collectors — incremental avg instead of full reduce per call                              | packages/resilience/src/observability/metric-collectors.ts:140-142  | LOW      |

## Business Context

### Why This Task Exists

Analiza wykazala ze biblioteka ma solidna architekture (8/10) ale kilka
problemow moze powodowac trudne do debugowania bugi w produkcji:

- Concurrency issues w resilience patterns (abort signal nie propagowany)
- Type safety holes (unsafe casts ktore klamia callerowi)
- Silent failures (brakujace upcasters nie rzucaja bledow)
- Niepotrzebne dependencies (js-yaml w runtime)

### Success Metrics

- Zero unsafe `as TError` casts w publicznym API
- Abort signal propagowany w withAttempt()
- js-yaml/gray-matter w devDependencies (nie dependencies)
- Zero martwych aliasow w tsconfig
- Wszystkie testy passing

## Implementation Plan

### Phase 1: Architecture Cleanup (30 min)

- [ ] **A3**: Przeniesc js-yaml i gray-matter z dependencies do devDependencies
      w packages/utils/package.json
- [ ] **A1**: Usunac martwe aliasy z tsconfig.base.json (cli, event-scheduling,
      event-store, process-managers)

### Phase 2: Concurrency & Performance Fixes (2h)

- [ ] **C2**: Dodac abort propagation w withAttempt() —
      `context.signal.addEventListener('abort', () => newController.abort(...), { once: true })`
- [ ] **R1**: Bulkhead timeout — zapisac timeoutId i clearTimeout po
      resolve/reject
- [ ] **P3**: Incremental average zamiast reduce per recordExecution

### Phase 3: Type Safety Fixes (2h)

- [ ] **T1**: Result.mapAsync() — wrappowac w try/catch zamiast
      `error as TError`, uzyc type guard lub `error instanceof TError`
- [ ] **T2**: AuditCapability.attach() — dodac
      `typeof (aggregate as any).apply === 'function'` runtime check

### Phase 4: Error Handling Fixes (1h)

- [ ] **E1**: Poprawic DomainErrorCode.MissingValue →
      DomainErrorCode.InvalidParameter w InvalidParameterError.withParameter()
- [ ] **E3**: VersioningCapability — logowac warning gdy upcaster nie istnieje
      dla danej wersji (nie silent skip)

### Phase 5: Immutability Fix (30 min)

- [ ] **I2**: \_internal_setState() —
      `this._domainEvents = [...state.domainEvents]` zamiast referencji

### Phase 6: Tests (2h)

- [ ] Testy na abort propagation w withAttempt
- [ ] Testy na bulkhead timeout cleanup
- [ ] Testy na Result.mapAsync error handling
- [ ] Testy na AuditCapability.attach() z nieprawidlowym obiektem
- [ ] Testy na VersioningCapability z brakujacym upcasterem

## Code References

```yaml
packages:
  - package: '@vytches/ddd-utils'
    files:
      - package.json (A3)
      - src/result.ts (T1)
  - package: '@vytches/ddd-resilience'
    files:
      - src/core/resilience-context.ts (C2)
      - src/patterns/bulkhead.ts (R1)
      - src/observability/metric-collectors.ts (P3)
  - package: '@vytches/ddd-aggregates'
    files:
      - src/capabilities/audit-capability.ts (T2)
      - src/capabilities/versioning-capability.ts (E3)
      - src/core/aggregate-root.ts (I2)
  - package: '@vytches/ddd-domain-primitives'
    files:
      - src/errors/domain.errors.ts (E1)
  - package: 'root'
    files:
      - tsconfig.base.json (A1)
```

## Risk Assessment

| Risk                                     | Probability | Impact | Mitigation                         |
| ---------------------------------------- | ----------- | ------ | ---------------------------------- |
| js-yaml move breaks build                | Low         | High   | Verify build scripts that use yaml |
| Error code change breaks consumer        | Low         | Medium | Consumer catches by type not code  |
| Abort propagation changes retry behavior | Medium      | Medium | Test retry scenarios               |

## Related ADR

- ADR-0025: Quality baseline before refactoring (extension)

---

_Task managed by Project Orchestrator | Created: 2026-04-02_
