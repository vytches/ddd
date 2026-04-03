# Task: Quickstart Example Repository

## Task Metadata

```yaml
task_id: 2026-03-31-020
title: Quickstart Example Repository - Working Reference Implementation
type: documentation
priority: normal
complexity: medium
estimated_time: 16h
created_by: human
created_at: 2026-03-31 14:00
status: completed
```

## Domain Context

```yaml
bounded_context: DeveloperOnboarding
aggregates:
  - Order (example)
  - Product (example)
entities:
  - OrderItem (example)
value_objects:
  - Money (example)
  - Address (example)
domain_events:
  - OrderPlaced (example)
  - OrderCancelled (example)
patterns:
  - CQRS
  - Event Sourcing
  - Aggregate Root
  - Value Object
  - Specification
  - Repository
```

## Business Context

### Why This Task Exists

Strategic maturity report wskazuje onboarding time na **15+ minut** z "analysis
paralysis" przy wyborze pakietow. Cel: **<5 minut** od npm install do
dzialajacego kodu.

Biblioteka ma 21 pakietow ale ZERO dzialajacego przykladu end-to-end. Consumer
project (juz-ide-api) jest za duzy i za skomplikowany zeby sluzyc jako przyklad.
Developer musi:

1. Przeczytac README kazdego pakietu
2. Zgadywac jak pakiety wspolpracuja
3. Pisac boilerplate od zera

Potrzebny jest **minimalny ale kompletny** przyklad ktory pokazuje caly flow DDD
z biblioteka.

### Expected Business Value

- [ ] Developer uruchamia dzialajacy przyklad w <5 minut
- [ ] Kazdy pattern biblioteki zademonstrowany w jednym projekcie
- [ ] Reference implementation do kopiowania
- [ ] LLM moze wczytac caly przyklad i generowac kod w stylu projektu

### Success Metrics

- `git clone → npm install → npm test` dziala w <2 minuty
- Przyklad pokrywa: aggregate, value object, command, query, event,
  specification, repository
- Nowy developer rozumie pattern biblioteki po przeczytaniu przykladu
- <500 LOC calego przykladu (minimal but complete)

## Technical Context

### Current State

- Zero dzialajacych przykladow end-to-end
- README.md zawiera fragmenty kodu ale nie kompletny projekt
- Consumer project (juz-ide-api) jest za duzy (16K testow, 237 agregatow)
- Brak prostego "hello world" dla DDD z @vytches/ddd

### Desired State

Osobne repozytorium (lub katalog `examples/` w monorepo) z:

```
examples/quickstart/
  package.json           # @vytches/ddd-enterprise as dependency
  tsconfig.json
  src/
    domain/
      order.aggregate.ts       # AggregateRoot z event sourcing
      money.value-object.ts    # ValueObject z walidacja
      order-placed.event.ts    # DomainEvent
      order.spec.ts            # Specification (inline!)
    application/
      create-order.command.ts  # Command + Handler
      get-order.query.ts       # Query + Handler
    infrastructure/
      order.repository.ts      # In-memory repository
    tests/
      order.aggregate.test.ts  # Unit test agregatu
      create-order.test.ts     # Integration test command
  README.md                    # 5-minute walkthrough
```

### Technical Constraints

- Uzyc TYLKO `@vytches/ddd-enterprise` (meta-package) - nie wymuszac wyboru
  pakietow
- Zero zewnetrznych zaleznosci (bez bazy danych, bez frameworka)
- Musi kompilowac sie i testy musza przechodzic
- Pokazac inline specs (nie class-based) - promowac lepszy pattern
- Jesli GWT testing (VF-015) bedzie gotowe - uzyc w testach

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] Dzialajacy przyklad z `npm install && npm test`
- [ ] AggregateRoot z minimum 2 command methods
- [ ] Minimum 1 ValueObject z walidacja
- [ ] Minimum 2 DomainEvents
- [ ] Command + Query z handlerami
- [ ] Inline Specification (demonstracja Specification.create())
- [ ] In-memory Repository
- [ ] Unit test agregatu
- [ ] Integration test command flow

### Non-Functional Requirements

- [ ] Performance: nie dotyczy (przyklad)
- [ ] Security: nie dotyczy (przyklad)
- [ ] Documentation: README z 5-minute walkthrough
- [ ] Testing: 100% testow passing, >80% coverage

### Definition of Done

- [ ] `npm install && npm test` dziala od zera
- [ ] README z step-by-step walkthrough
- [ ] Kazdy pattern biblioteki zademonstrowany
- [ ] <500 LOC (bez testow)
- [ ] Inline specs uzyty zamiast class-based
- [ ] Kompatybilny z LLMGUIDE (AI moze go przeczytac)

## Implementation Plan

### Phase 1: Project Setup

- **Tasks**:
  - [ ] Stworzyc `examples/quickstart/` w monorepo
  - [ ] package.json z @vytches/ddd-enterprise dependency
  - [ ] tsconfig.json
  - [ ] Vitest config
- **Output**: Pustry projekt ktory sie kompiluje

### Phase 2: Domain Layer

- **Tasks**:
  - [ ] Order aggregate (create, addItem, place, cancel)
  - [ ] Money value object (currency + amount, walidacja)
  - [ ] OrderPlaced, OrderCancelled events
  - [ ] Inline specifications (isPlaceable, hasMinimumValue)
- **Output**: Kompletny domain layer

### Phase 3: Application + Infrastructure

- **Tasks**:
  - [ ] CreateOrderCommand + handler
  - [ ] GetOrderQuery + handler
  - [ ] InMemoryOrderRepository
- **Output**: Dzialajacy CQRS flow

### Phase 4: Tests + Documentation

- **Tasks**:
  - [ ] Unit testy agregatu (opcjonalnie GWT jesli VF-015 gotowe)
  - [ ] Integration test command → event → query
  - [ ] README z 5-minute walkthrough
  - [ ] Komentarze w kodzie wyjasniajace "dlaczego" nie "co"
- **Output**: Production-ready example

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

| Risk                                          | Probability | Impact | Mitigation                            |
| --------------------------------------------- | ----------- | ------ | ------------------------------------- |
| Enterprise package nie eksportuje wszystkiego | Low         | Medium | Sprawdzic eksporty wczesnie           |
| Przyklad za prosty (nie pokazuje wartosci)    | Medium      | Medium | Review z consumer project perspective |
| Przyklad za skomplikowany (>500 LOC)          | Medium      | Low    | Strict LOC budget, cut scope          |

### Dependencies

- **VF-014** (LLM docs) - przyklad powinien byc spojny z LLMGUIDE
- **VF-015** (GWT testing) - opcjonalnie uzyc w testach jesli gotowe
- **VF-016** (inline specs) - przyklad MUSI uzywac inline specs

## Related ADR

- ADR-0032: Quickstart Example Repository Strategy

---

_Task managed by Project Orchestrator | Created: 2026-03-31_
