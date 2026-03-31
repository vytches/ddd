# Task: Quick Quality Baseline

## Task Metadata

```yaml
task_id: 2026-03-31-012
title: Quick Quality Baseline - Fix flaky test, hardcoded paths, stabilize CI
type: bug
priority: high
complexity: simple
estimated_time: 2h
created_by: human
created_at: 2026-03-31 13:30
status: planned
```

## Domain Context

```yaml
bounded_context: LibraryInfrastructure
aggregates: []
entities: []
value_objects: []
domain_events: []
patterns:
  - CI Stability
  - Configuration Management
```

## Business Context

### Why This Task Exists

Przed rozpoczeciem jakichkolwiek refaktorow i nowych funkcjonalnosci, baza kodu
musi byc stabilna. Aktualnie:

1. **Flaky performance test** w `packages/nestjs` - test oczekuje
   `registrationTime > 1ms`, ale serwis rejestruje sie w ~0.47ms (za szybko dla
   progu). Test losowo failuje w zaleznosci od hardware'u.
2. **Hardcoded absolute paths** w `jsdoc-adapter.ts` i
   `test-jsdoc-coverage.js` - uzywaja `/opt/projects/vytches-ddd/...` zamiast
   sciezek relatywnych. Psuja sie przy zmianie srodowiska.

Te problemy blokuja zaufanie do CI i utrudniaja prace na roznych maszynach.

### Expected Business Value

- [ ] 100% testow przechodzi stabilnie (2163/2163)
- [ ] Projekt dziala na dowolnej maszynie bez edycji sciezek
- [ ] Czysta baza do dalszych refaktorow

### Success Metrics

- Zero flaky testow w 10 kolejnych uruchomieniach CI
- Brak hardcoded absolute paths w zadnym pliku zrodlowym

## Technical Context

### Current State

- `packages/nestjs/tests/realistic-enterprise-integration.test.ts:308` -
  assertion `expect(registrationTime).toBeGreaterThan(1)` failuje gdy serwis
  jest za szybki
- `packages/cli/src/examples-engine/adapters/jsdoc-adapter.ts` - hardcoded
  `/opt/projects/vytches-ddd/docs/examples/domain/...`
- `test-jsdoc-coverage.js` - hardcoded
  `/opt/projects/vytches-ddd/packages/resilience/dist`

### Desired State

- Performance test uzywa sensownych, stabilnych asercji (np.
  `toBeGreaterThanOrEqual(0)` + `toBeLessThan(500)`)
- Wszystkie sciezki relatywne lub oparte o `__dirname` / `process.cwd()`

### Technical Constraints

- Nie zmieniac logiki testow - tylko progi asercji
- Zachowac backward compatibility sciezek w CLI
- Nie dodawac nowych zaleznosci

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] Fix performance test assertion w nestjs package
- [ ] Zamiana hardcoded paths na relatywne w jsdoc-adapter.ts
- [ ] Zamiana hardcoded paths na relatywne w test-jsdoc-coverage.js
- [ ] Sprawdzenie czy nie ma wiecej hardcoded paths w codebase (grep)

### Non-Functional Requirements

- [ ] Performance: brak zmian
- [ ] Security: brak zmian
- [ ] Documentation: brak (internal fix)
- [ ] Testing: 2163/2163 passing stabilnie

### Definition of Done

- [ ] Wszystkie testy passing
- [ ] Zero hardcoded absolute paths
- [ ] Zweryfikowane na czystym `git clone`

## Implementation Plan

### Phase 1: Fix Flaky Test

- **Tasks**:
  - [ ] Zmiana assertion z `toBeGreaterThan(1)` na `toBeGreaterThanOrEqual(0)`
  - [ ] Zachowanie gornego progu `toBeLessThan(500)`
- **Output**: Stabilny performance test

### Phase 2: Fix Hardcoded Paths

- **Tasks**:
  - [ ] jsdoc-adapter.ts - uzyc `path.resolve(__dirname, ...)` lub relatywnej
        sciezki
  - [ ] test-jsdoc-coverage.js - uzyc `path.resolve(process.cwd(), ...)`
  - [ ] Grep codebase na inne wystapienia hardcoded paths
- **Output**: Portable codebase

## Progress Tracking

### Current Status

```yaml
overall_progress: 0%
current_phase: planned
blockers: []
last_updated: 2026-03-31 13:30
```

### Activity Log

| Date | Agent | Action | Result |
| ---- | ----- | ------ | ------ |
|      |       |        |        |

## Code References

### Files to Modify

```yaml
packages:
  - package: '@vytches/ddd-nestjs'
    files:
      - tests/realistic-enterprise-integration.test.ts
  - package: '@vytches/ddd-cli'
    files:
      - src/examples-engine/adapters/jsdoc-adapter.ts
  - package: 'root'
    files:
      - test-jsdoc-coverage.js
```

## Risk Assessment

### Technical Risks

| Risk                       | Probability | Impact | Mitigation                 |
| -------------------------- | ----------- | ------ | -------------------------- |
| Performance test too loose | Low         | Low    | Keep upper bound assertion |
| Relative path breaks build | Low         | Medium | Test on clean checkout     |

## Testing Strategy

### Unit Tests

- [ ] Verify nestjs test passes 10x consecutively
- [ ] Verify jsdoc-adapter works with relative paths

## Related ADR

- ADR-0025: Quality baseline before refactoring

---

_Task managed by Project Orchestrator | Created: 2026-03-31_
