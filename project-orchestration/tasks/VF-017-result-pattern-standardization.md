# Task: Result<T,E> Pattern Standardization

## Task Metadata

```yaml
task_id: 2026-03-31-017
title:
  Result<T,E> Pattern Standardization + Constructor Cleanup (VF-010 Remaining)
type: refactor
priority: high
complexity: complex
estimated_time: 40h
created_by: human
created_at: 2026-03-31 14:00
status: planned
```

## Domain Context

```yaml
bounded_context: LibraryCore
aggregates:
  - AggregateRoot
entities: []
value_objects:
  - ValueObject
  - EntityId
domain_events: []
patterns:
  - Result Pattern
  - Factory Method
  - Constructor Standardization
```

## Business Context

### Why This Task Exists

VF-010 (Library Quality Improvements) jest w 37% ukonczony. Trzy kluczowe
pozycje nadal czekaja i stanowia najwiekszy dlug jakosciowy w bibliotece:

1. **Result<T,E> pattern** - niespojny uzytek w calej bibliotece. Niektore
   metody rzucaja wyjatki, inne zwracaja Result, inne zwracaja `T | null`.
   Consumer project musi zgadywac jaki pattern uzywa dana metoda.
2. **Constructor patterns** - rozne konwencje w roznych pakietach (some use
   `create()`, others `new`, others `from()`). Brak spattern hierarchy.
3. **EntityIdFactory removal** - redundantny factory, EntityId.create()
   wystarczy.

To sa pozostalosci z VF-010 ktory zostal czesciowo zrealizowany (factory naming
done, logger integration done, TODO/FIXME done).

### Expected Business Value

- [ ] Spojny Result<T,E> pattern we wszystkich publicznych API
- [ ] Developer nie musi zgadywac czy metoda rzuca wyjatek czy zwraca Result
- [ ] Jasna konwencja konstruktorow w calej bibliotece
- [ ] Usuniecie redundantnego EntityIdFactory

### Success Metrics

- 100% publicznych factory methods zwraca Result<T,E>
- Zero publicznych metod rzucajacych wyjatki (domain layer)
- Spojna konwencja: `ClassName.create()` dla factory, `new ClassName()` tylko
  internal
- EntityIdFactory usuniety, zero referencji

## Technical Context

### Current State

Niespojnosc pattern:

```typescript
// Pattern A: Result (poprawny)
const result = ValueObject.create(props); // Result<ValueObject, DomainError>

// Pattern B: Exception (niepoprawny w domain layer)
const entity = new Entity(props); // throws if invalid

// Pattern C: Nullable (niejednoznaczny)
const found = repository.findById(id); // T | null | undefined

// Pattern D: Mixed (najgorszy)
class SomeAggregate {
  addItem(item: Item): void { // throws on invalid
    ...
  }
  validateState(): Result<void, ValidationError> { // returns Result
    ...
  }
}
```

### Desired State

```typescript
// Jedna konwencja: Result<T,E> dla wszystkich operacji ktore moga failowac
const vo = MyValueObject.create(props);        // Result<MyValueObject, DomainError>
const result = aggregate.addItem(item);         // Result<void, DomainError>
const found = repository.findById(id);          // Result<T, NotFoundError>

// Konstruktory: prywatne, tylko factory methods publiczne
class MyValueObject extends ValueObject<Props> {
  private constructor(props: Props) { super(props); }
  static create(props: Props): Result<MyValueObject, ValidationError> { ... }
}
```

### Technical Constraints

- **MOZE BYC BREAKING CHANGE** - zmiana return types z `void` (throws) na
  `Result<void, E>`
- Wymaga koordynacji z consumer project (juz-ide-api)
- Nie mozna zmienic wszystkiego na raz - potrzebny plan migracyjny
- Zachowac backward compat gdzie mozliwe (deprecate + new method)

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] Audit: zidentyfikowac wszystkie publiczne metody ktore rzucaja wyjatki
- [ ] Audit: zidentyfikowac niespojne return types (T|null vs Result)
- [ ] Migrowac domain-primitives: ValueObject.create() → Result
- [ ] Migrowac aggregates: command methods → Result
- [ ] Migrowac value-objects: factory methods → Result
- [ ] Usunac EntityIdFactory (zastapic EntityId.create())
- [ ] Standaryzowac constructor pattern: private constructor + static create()

### Non-Functional Requirements

- [ ] Performance: Result<T,E> nie wolniejszy niz try/catch (benchmark)
- [ ] Security: brak wplywu
- [ ] Documentation: migration guide (throws → Result)
- [ ] Testing: testy zaktualizowane do nowych return types

### Definition of Done

- [ ] Zero publicznych metod rzucajacych wyjatki w domain layer
- [ ] 100% factory methods zwraca Result<T,E>
- [ ] EntityIdFactory usuniety
- [ ] Migration guide napisany
- [ ] Wszystkie testy passing
- [ ] Consumer project moze migrowac inkrementalnie

## Implementation Plan

### Phase 1: Audit & Impact Analysis

- **Tasks**:
  - [ ] Grep wszystkie `throw` w packages/\*/src/
  - [ ] Grep wszystkie `| null` i `| undefined` return types
  - [ ] Zidentyfikowac breaking vs non-breaking changes
  - [ ] Stworzyc migration plan
- **Output**: Impact matrix + migration plan

### Phase 2: Core Packages (Non-Breaking)

- **Tasks**:
  - [ ] Dodac `Result.fromNullable()` helper jesli brak
  - [ ] Migrowac ValueObject base class
  - [ ] Migrowac EntityId factory
  - [ ] Usunac EntityIdFactory
- **Output**: Spójne core packages

### Phase 3: Aggregate & CQRS (Potentially Breaking)

- **Tasks**:
  - [ ] Migrowac aggregate command methods → Result
  - [ ] Migrowac CQRS handler return types → Result
  - [ ] Deprecate stare sygnatury (jesli mozliwe)
- **Output**: Result pattern w calym domain layer

### Phase 4: Documentation & Migration Guide

- **Tasks**:
  - [ ] Napisac migration guide: throws → Result
  - [ ] Zaktualizowac JSDoc / LLMGUIDE
  - [ ] Przyklady before/after
- **Output**: Developer-ready migration path

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

| Risk                                   | Probability | Impact | Mitigation                    |
| -------------------------------------- | ----------- | ------ | ----------------------------- |
| Breaking change w aggregate methods    | High        | High   | Deprecation period + dual API |
| Consumer project wymaga duzej migracji | Medium      | High   | Inkrementalny plan migracji   |
| Result<T,E> performance overhead       | Low         | Medium | Benchmark vs try/catch        |

## Related ADR

- ADR-0029: Result<T,E> Pattern Standardization Strategy

---

_Task managed by Project Orchestrator | Created: 2026-03-31_
