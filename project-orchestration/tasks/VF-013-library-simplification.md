# Task: Library Simplification - Remove Dead Packages

## Task Metadata

```yaml
task_id: 2026-03-31-013
title:
  Library Simplification - Remove sagas, process-managers, event-scheduling, CLI
  bloat
type: refactor
priority: high
complexity: complex
estimated_time: 16h
created_by: human
created_at: 2026-03-31 13:30
status: planned
```

## Domain Context

```yaml
bounded_context: LibraryArchitecture
aggregates: []
entities: []
value_objects: []
domain_events: []
patterns:
  - Package Elimination
  - API Surface Reduction
  - Migration Guide
```

## Business Context

### Why This Task Exists

Strategic maturity report (2026-03-31) wykazal, ze biblioteka ma 21 pakietow, co
przytlacza nowych developerow. Kilka pakietow jest over-engineered lub ma lepsze
dedykowane alternatywy:

1. **@vytches/ddd-sagas** (794 LOC) - Temporal.io i BullMQ sa lepsze. Wlasciciel
   projektu podjal decyzje o usunieciu.
2. **@vytches/ddd-process-managers** (2243-liniowe README) - ekstremalnie
   over-engineered na potrzeby biblioteki DDD.
3. **@vytches/ddd-event-scheduling** (29 LOC) - minimalna wartosc,
   pg-boss/BullMQ pokrywaja to lepiej.
4. **@vytches/ddd-cli** (26,135 LOC) - AI discovery, intent classifiers, complex
   analysis to bloat. CLI nie jest utrzymywane od miesiecy i nie dziala.

Cel: zejsc z 21 do ~17 pakietow, zmniejszyc cognitive load i maintenance burden.

### Expected Business Value

- [ ] Redukcja z 21 do 17 pakietow (-19%)
- [ ] Jasniejszy mental model: Foundation -> Patterns -> Integration ->
      Infrastructure
- [ ] Mniej kodu do utrzymania (~29,000 LOC mniej)
- [ ] Szybszy onboarding (<5 min zamiast 15+ min)

### Success Metrics

- 17 pakietow w monorepo (lub mniej)
- Zero broken imports w enterprise package
- Migration guide dla uzytkownikow usuwaanych pakietow
- Wszystkie testy passing po refaktorze

## Technical Context

### Current State

| Package              | LOC    | Problem                                                   |
| -------------------- | ------ | --------------------------------------------------------- |
| ddd-sagas            | 794    | Over-engineered, lepsze alternatywy (Temporal.io, BullMQ) |
| ddd-process-managers | ~2000+ | Ekstremalnie over-engineered, 2243-liniowe README         |
| ddd-event-scheduling | 29     | Minimalna wartosc, pg-boss lepszy                         |
| ddd-cli              | 26,135 | Nie dziala od miesiecy, AI bloat, nie bedzie utrzymywany  |

### Desired State

- Pakiety usuniete z monorepo
- Enterprise meta-package zaktualizowany (usuniete re-eksporty)
- Dokumentacja z rekomendacjami zewnetrznych alternatyw
- Clean dependency graph bez osieroconych referencji

### Technical Constraints

- **BREAKING CHANGE** - wymaga major version bump (v2.0.0) lub przynajmniej
  jasnej komunikacji
- Sprawdzic czy consumer projekt (juz-ide-api) uzywa ktoregos z tych pakietow
- Nie usuwac interfejsow ktore sa re-eksportowane przez inne pakiety
- Zachowac git history (usunac pliki, nie rewrite history)

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] Usunac pakiet `packages/sagas` (jesli istnieje) lub zweryfikowac ze nie
      istnieje
- [ ] Usunac pakiet `packages/process-managers` (jesli istnieje) lub
      zweryfikowac
- [ ] Usunac pakiet `packages/event-scheduling` (jesli istnieje) lub
      zweryfikowac
- [ ] Zredukowac `packages/cli` do minimum lub usunac calkowicie
- [ ] Zaktualizowac `packages/enterprise` meta-package - usunac re-eksporty
- [ ] Zaktualizowac root `pnpm-workspace.yaml`
- [ ] Zaktualizowac `nx.json` i project graph
- [ ] Zaktualizowac README.md - lista pakietow

### Non-Functional Requirements

- [ ] Performance: brak wplywu (usuwamy kod)
- [ ] Security: brak wplywu (mniej attack surface)
- [ ] Documentation: migration guide dla kazdego usunietego pakietu
- [ ] Testing: wszystkie pozostale testy passing

### Definition of Done

- [ ] Pakiety usuniete
- [ ] Zero osieroconych importow/referencji
- [ ] Migration guide napisany
- [ ] CI green
- [ ] Enterprise package dziala bez usunietych pakietow

## Implementation Plan

### Phase 1: Audit & Impact Analysis

- **Tasks**:
  - [ ] Zweryfikowac ktore z 4 pakietow faktycznie istnieja w monorepo
  - [ ] Grep cross-package imports do tych pakietow
  - [ ] Sprawdzic consumer project dependencies
- **Output**: Lista pakietow do usuniecia + impact matrix

### Phase 2: Remove Packages

- **Tasks**:
  - [ ] Usunac katalogi pakietow
  - [ ] Zaktualizowac pnpm-workspace.yaml
  - [ ] Zaktualizowac nx.json / project.json
  - [ ] Zaktualizowac enterprise meta-package
  - [ ] Usunac z tsconfig references
- **Output**: Clean monorepo bez martwych pakietow

### Phase 3: Update Documentation

- **Tasks**:
  - [ ] Napisac migration guide (jakie alternatywy uzyc)
  - [ ] Zaktualizowac README z nowa lista pakietow
  - [ ] Zaktualizowac CLAUDE.md / project.yml
- **Output**: Aktualna dokumentacja

### Phase 4: Verify

- **Tasks**:
  - [ ] Pelny build (`pnpm build`)
  - [ ] Pelne testy (`pnpm test`)
  - [ ] Type check (`pnpm type-check`)
  - [ ] Architecture check (circular deps)
- **Output**: Green CI

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

## Risk Assessment

### Technical Risks

| Risk                                  | Probability | Impact | Mitigation                    |
| ------------------------------------- | ----------- | ------ | ----------------------------- |
| Consumer project uses removed package | Medium      | High   | Audit imports before removal  |
| Enterprise package breaks             | Medium      | High   | Test re-exports after removal |
| Orphaned type references              | Low         | Medium | Full type-check after removal |

## Related ADR

- ADR-0024: Library Simplification Strategy (already exists)

---

_Task managed by Project Orchestrator | Created: 2026-03-31_
