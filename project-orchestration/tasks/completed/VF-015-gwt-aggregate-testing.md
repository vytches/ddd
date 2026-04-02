# Task: GWT Aggregate Testing API

## Task Metadata

```yaml
task_id: 2026-03-31-015
title: Given-When-Then Aggregate Testing API
type: feature
priority: normal
complexity: complex
estimated_time: 12h
created_by: human
created_at: 2026-03-31 13:30
status: completed
```

## Domain Context

```yaml
bounded_context: TestingFramework
aggregates:
  - AggregateRoot
entities: []
value_objects: []
domain_events:
  - DomainEvent
patterns:
  - Given-When-Then
  - BDD Testing
  - Event Sourcing Testing
```

## Business Context

### Why This Task Exists

Strategic maturity report (2026-03-31) zidentyfikowal brak GWT testing jako
kluczowy gap. Consumer project (juz-ide-api) ma 237 agregatow i 16K testow.
Kazdy test agregatu wymaga powtarzalnego boilerplate'u:

- Tworzenie agregatu
- Ladowanie historii eventow (`loadFromHistory`)
- Wywolanie komendy
- Wyciaganie uncommitted events
- Asercje na eventach

GWT API eliminuje ten boilerplate i daje czytelna, deklaratywna skladnie testow.

**Wazne**: to jest **czysto addytywne** - nowe eksporty w
`@vytches/ddd-testing`, zero zmian w istniejacym API. Nie jest to breaking
change.

### Expected Business Value

- [ ] Redukcja boilerplate'u testowego z ~15 LOC do ~5 LOC per test
- [ ] Testy czytaja sie jak specyfikacja biznesowa
- [ ] Lepsze error messages (kontekst GWT w bledie)
- [ ] Competitive parity z Emmett i Axon Framework

### Success Metrics

- GWT API pokrywa 100% scenariuszy testowania agregatow (create, command, error,
  multi-event)
- Dokumentacja z >= 10 przykladami uzycia
- Zero wplywu na istniejace testy (addytywne)
- Consumer project moze przepisac testy agregatow bez zmiany logiki

## Technical Context

### Current State

Test agregatu wyglada tak:

```typescript
it('should place order', () => {
  const order = new Order();
  order.loadFromHistory([new OrderCreated({ id: '1', customerId: 'c1' })]);

  order.place({ items: [{ sku: 'ABC', qty: 2 }] });

  const events = order.getUncommittedEvents();
  expect(events).toHaveLength(1);
  expect(events[0]).toBeInstanceOf(OrderPlaced);
  expect(events[0].payload.items[0].sku).toBe('ABC');
});
```

### Desired State

Ten sam test w GWT:

```typescript
Test(Order)
  .given(new OrderCreated({ id: '1', customerId: 'c1' }))
  .when(order => order.place({ items: [{ sku: 'ABC', qty: 2 }] }))
  .then(new OrderPlaced({ items: [{ sku: 'ABC', qty: 2 }] }));
```

Dodatkowe warianty:

```typescript
// Nowy agregat
Test(Order)
  .givenNothing()
  .when(order => order.create({ customerId: 'c1' }))
  .then(new OrderCreated({ customerId: 'c1' }));

// Oczekiwany blad
Test(Order)
  .given(new OrderCreated({ id: '1' }), new OrderCancelled({ id: '1' }))
  .when(order => order.place({ items: [] }))
  .thenError('ORDER_ALREADY_CANCELLED');

// Wiele eventow
Test(Order)
  .given(new OrderCreated({ id: '1' }))
  .when(order => order.addItems([{ sku: 'A' }, { sku: 'B' }]))
  .then(new ItemAdded({ sku: 'A' }), new ItemAdded({ sku: 'B' }));

// Async command
Test(Order)
  .given(new OrderCreated({ id: '1' }))
  .whenAsync(async order => await order.validateAndPlace(items))
  .then(new OrderPlaced({ ... }));
```

### Technical Constraints

- Musi dzialac z istniejacym `AggregateRoot` base class
- Musi dzialac z `loadFromHistory()` i `getUncommittedEvents()`
- Type-safe: TypeScript musi inferowac typ agregatu
- Nie dodawac zaleznosci na Vitest/Jest - framework-agnostic assertions
- Utrzymac maly bundle size (<5KB)

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] `Test(AggregateClass)` - entry point, tworzy builder
- [ ] `.given(...events)` - laduje historie eventow
- [ ] `.givenNothing()` - nowy agregat bez historii
- [ ] `.when(fn)` - wywoluje komende na agregacie (sync)
- [ ] `.whenAsync(fn)` - wywoluje async komende
- [ ] `.then(...expectedEvents)` - asercja na wyprodukowane eventy
- [ ] `.thenError(code)` - asercja na blad domenowy (Result failure lub
      exception)
- [ ] `.thenNothing()` - asercja ze brak nowych eventow
- [ ] Czytelne error messages z kontekstem GWT

### Non-Functional Requirements

- [ ] Performance: zero overhead w produkcji (testing-only package)
- [ ] Security: nie dotyczy (test utility)
- [ ] Documentation: LLMGUIDE.md + JSDoc + 10+ przykladow
- [ ] Testing: >90% coverage na samym GWT framework

### Definition of Done

- [ ] GWT API zaimplementowane w `packages/testing`
- [ ] Eksportowane z `@vytches/ddd-testing`
- [ ] Testy frameworku passing (>90% coverage)
- [ ] Minimum 10 przykladow w dokumentacji
- [ ] LLMGUIDE.md zaktualizowany
- [ ] Type inference dziala (test z expect-type)

## Implementation Plan

### Phase 1: Core GWT Builder

- **Tasks**:
  - [ ] Klasa `AggregateTestBuilder<T extends AggregateRoot>`
  - [ ] Metody `given()`, `givenNothing()`, `when()`, `whenAsync()`
  - [ ] Metody `then()`, `thenError()`, `thenNothing()`
  - [ ] Entry point `Test()` function
- **Output**: Core API

### Phase 2: Assertions & Error Messages

- **Tasks**:
  - [ ] Deep comparison eventow (typ + payload, ignorujac metadata)
  - [ ] Czytelne error messages: "Given [events], When [action], Expected [X]
        but got [Y]"
  - [ ] Support dla partial matching (sprawdz tylko wybrane pola payload)
- **Output**: Robust assertions

### Phase 3: Tests & Documentation

- **Tasks**:
  - [ ] Unit tests GWT frameworku (mock aggregate)
  - [ ] Integration tests z prawdziwym AggregateRoot
  - [ ] Przyklady w LLMGUIDE.md
  - [ ] JSDoc na wszystkich publicznych metodach
- **Output**: Production-ready feature

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

| Risk                            | Probability | Impact | Mitigation                                 |
| ------------------------------- | ----------- | ------ | ------------------------------------------ |
| AggregateRoot API nie wystarczy | Low         | High   | Audit loadFromHistory/getUncommittedEvents |
| Type inference nie dziala       | Medium      | Medium | Prototyp z expect-type wczesnie            |
| Event comparison zbyt strict    | Medium      | Low    | Partial matching jako default              |

## Related ADR

- ADR-0026: GWT Aggregate Testing API Design

---

_Task managed by Project Orchestrator | Created: 2026-03-31_
