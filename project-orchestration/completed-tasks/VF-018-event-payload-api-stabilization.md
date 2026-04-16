# Task: Event Payload API Stabilization

## Task Metadata

```yaml
task_id: 2026-03-31-018
title: Event Payload API Stabilization - Prevent Future Breaking Migrations
type: refactor
priority: high
complexity: medium
estimated_time: 8h
created_by: human
created_at: 2026-03-31 14:00
status: completed
```

## Domain Context

```yaml
bounded_context: EventSystem
aggregates: []
entities: []
value_objects: []
domain_events:
  - DomainEvent
  - IntegrationEvent
patterns:
  - Event Sourcing
  - Event Payload Contract
  - API Stability
```

## Business Context

### Why This Task Exists

Strategic maturity report zidentyfikowal niedawna breaking migration w event
payload API:

- Zmiana z `getBusinessData()` na `payload.businessData` wymusila aktualizacje
  **168+ plikow** w consumer project.
- Tego typu migracja niszczy zaufanie do biblioteki i spowalnia adopcje.

Cel: ustabilizowac event payload API tak, zeby przyszle zmiany byly addytywne
(nie-breaking).

### Expected Business Value

- [ ] Zero breaking changes w event payload API do v2.0
- [ ] Jasny kontrakt co jest public API a co internal
- [ ] Consumer project nie musi aktualizowac setek plikow przy minor version
      bump
- [ ] Zaufanie do stabilnosci biblioteki

### Success Metrics

- Event payload API oznaczone jako `@stable` w JSDoc
- API Extractor / public API surface zdefiniowany i monitorowany
- Deprecation warnings zamiast naglyych zmian
- Zero breaking changes w event API w nastepnych 6 miesiacach

## Technical Context

### Current State

Event payload API ewoluowalo bez jasnego kontraktu:

- `getBusinessData()` → `payload.businessData` (breaking, 168 plikow)
- Brak oznaczenia co jest `@public` vs `@internal` vs `@experimental`
- Brak API surface monitoring (Microsoft API Extractor jest w devDeps ale
  nieuzywany?)
- Consumer project musi traktowac kazdy upgrade jako potencjalnie breaking

### Desired State

```typescript
// Jasny kontrakt w JSDoc
export class DomainEvent<TPayload = unknown> {
  /** @public @stable @since 0.22.0 */
  readonly payload: Readonly<TPayload>;

  /** @public @stable @since 0.22.0 */
  readonly metadata: EventMetadata;

  /** @internal - DO NOT use in consumer code */
  readonly _internalState: unknown;
}
```

- Kazde publiczne API ma `@stable` lub `@experimental` tag
- API Extractor generuje `.api.md` ktory jest commitowany i reviewowany
- CI blokuje PR ktory zmienia `@stable` API bez major version bump

### Technical Constraints

- Nie zmieniac obecnego API (to jest stabilizacja, nie refaktor)
- API Extractor juz jest w devDeps - sprawdzic czy jest skonfigurowany
- Zachowac kompatybilnosc z istniejacym JSDoc injection system

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] Audit: zidentyfikowac caly public API surface pakietu events
- [ ] Oznaczyc wszystkie publiczne metody/properties jako `@public @stable` lub
      `@experimental`
- [ ] Oznaczyc internal jako `@internal`
- [ ] Skonfigurowac API Extractor dla pakietu events
- [ ] Wygenerowac `.api.md` baseline
- [ ] Dodac CI check: API Extractor diff na PR

### Non-Functional Requirements

- [ ] Performance: brak wplywu (tylko oznaczenia + tooling)
- [ ] Security: brak wplywu
- [ ] Documentation: API stability tags w JSDoc
- [ ] Testing: brak zmian w testach

### Definition of Done

- [ ] Caly event public API oznaczony stability tags
- [ ] API Extractor skonfigurowany i generuje baseline
- [ ] CI check na API surface changes
- [ ] Guideline: jak dodawac nowe API bez breaking changes

## Implementation Plan

### Phase 1: API Surface Audit

- **Tasks**:
  - [ ] Wylistowac wszystkie eksportowane symbole z packages/events
  - [ ] Wylistowac eksportowane symbole z packages/contracts (event interfaces)
  - [ ] Sklasyfikowac: stable / experimental / internal
- **Output**: API surface map

### Phase 2: Stability Tags

- **Tasks**:
  - [ ] Dodac `@public @stable` do ustalonych API
  - [ ] Dodac `@experimental` do nowych/niestabilnych API
  - [ ] Dodac `@internal` do implementation details
  - [ ] Zaktualizowac YAML metadata jesli potrzebne (JSDoc injection)
- **Output**: Oznaczony codebase

### Phase 3: API Extractor + CI

- **Tasks**:
  - [ ] Skonfigurowac `api-extractor.json` dla packages/events
  - [ ] Wygenerowac baseline `.api.md`
  - [ ] Dodac CI step: `api-extractor run --local` na PRach
  - [ ] Rozszerzyc na inne core packages (contracts, aggregates, cqrs)
- **Output**: Automated API stability monitoring

## Progress Tracking

### Current Status

```yaml
overall_progress: 0%
current_phase: planned
blockers: []
last_updated: 2026-03-31 14:00
```

### Activity Log

| Date | Agent | Action | Result |
| ---- | ----- | ------ | ------ |

## Risk Assessment

### Technical Risks

| Risk                                           | Probability | Impact | Mitigation                            |
| ---------------------------------------------- | ----------- | ------ | ------------------------------------- |
| API Extractor config complexity                | Medium      | Low    | Zaczac od jednego pakietu, rozszerzac |
| False positives w CI (internal change flagged) | Medium      | Low    | Dobrze sklasyfikowac internal         |
| JSDoc tags conflict z injection system         | Low         | Medium | Test injection po dodaniu tags        |

## Related ADR

- ADR-0030: Event Payload API Stability Contract

---

_Task managed by Project Orchestrator | Created: 2026-03-31_
