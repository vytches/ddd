# ADR-0027: Given-When-Then Aggregate Testing API

**Status**: Proposed **Date**: 2026-03-31 **Supersedes**: None **Context**:
Testing DX improvement for aggregate-heavy projects **Implementation**: VF-015

## Problem Statement

Consumer project (juz-ide-api) ma 237 agregatow i 16K testow. Kazdy test
agregatu powtarza ten sam boilerplate:

```typescript
it('should place order', () => {
  // SETUP: 4 linie
  const order = new Order();
  order.loadFromHistory([new OrderCreated({ id: '1', customerId: 'c1' })]);

  // ACT: 1 linia
  order.place({ items: [{ sku: 'ABC', qty: 2 }] });

  // ASSERT: 3-5 linii
  const events = order.getUncommittedEvents();
  expect(events).toHaveLength(1);
  expect(events[0]).toBeInstanceOf(OrderPlaced);
  expect(events[0].payload.items[0].sku).toBe('ABC');
});
```

Przy 237 agregatach to tysiace linii powtarzalnego kodu. Konkurencja (Emmett,
Axon) oferuje GWT API.

## Decision

**Dodac Given-When-Then testing API do `@vytches/ddd-testing` jako addytywna
funkcjonalnosc.**

### API Design

```typescript
// Entry point
function Test<T extends AggregateRoot>(
  aggregateClass: new () => T
): GivenStep<T>;

// Fluent chain
interface GivenStep<T> {
  given(...events: DomainEvent[]): WhenStep<T>;
  givenNothing(): WhenStep<T>;
}

interface WhenStep<T> {
  when(action: (aggregate: T) => void): ThenStep<T>;
  whenAsync(action: (aggregate: T) => Promise<void>): AsyncThenStep<T>;
}

interface ThenStep<T> {
  then(...expectedEvents: DomainEvent[]): void;
  thenError(errorCode: string): void;
  thenNothing(): void;
}
```

### Event Matching Strategy

Domyslnie: **structural matching** (typ + payload, ignorujac metadata jak
timestamp, eventId):

```typescript
// Te dwa eventy sa "rowne" w GWT:
new OrderPlaced({ items: [...] })  // expected
new OrderPlaced({ items: [...], metadata: { timestamp: '...' } })  // actual
```

Opcjonalnie: **partial matching** (sprawdz tylko podane pola):

```typescript
Test(Order)
  .given(new OrderCreated({ id: '1' }))
  .when(order => order.place(items))
  .then(matching(OrderPlaced, { itemCount: 2 })); // ignoruj reszta payload
```

### Error Messages

```
GWT Assertion Failed:

  Given:
    - OrderCreated { id: '1', customerId: 'c1' }

  When:
    - order.place({ items: [{ sku: 'ABC', qty: 2 }] })

  Expected:
    - OrderPlaced { items: [{ sku: 'ABC', qty: 2 }] }

  Actual:
    - OrderRejected { reason: 'INSUFFICIENT_STOCK' }
```

### Package Location

```
packages/testing/src/
  gwt/
    aggregate-test-builder.ts   # Core GWT fluent API
    event-matcher.ts            # Structural + partial event comparison
    gwt-error.ts                # Formatted error messages
    index.ts                    # Barrel export
```

Eksportowane z `@vytches/ddd-testing` — zero nowych pakietow.

## Design Decisions

### 1. Framework-agnostic assertions

GWT API rzuca `GWTAssertionError` (extends Error) zamiast uzywac `expect()` z
Vitest/Jest. Dzieki temu dziala z dowolnym test runner.

### 2. Sync-first, async-optional

Wiekszosc komend agregatow jest synchroniczna. `when()` dla sync, `whenAsync()`
dla async — nie wymuszamy `await` wszedzie.

### 3. Constructor-based aggregate creation

`Test(Order)` tworzy agregat przez `new Order()`. Jesli agregat wymaga
dependencies, mozna uzyc factory:

```typescript
Test(Order, () => new Order(mockEventBus))
  .given(...)
  .when(...)
  .then(...);
```

## Benefits

- ~70% redukcja boilerplate'u w testach agregatow
- Testy czytaja sie jak specyfikacja biznesowa
- Lepsze error messages z kontekstem GWT
- Competitive parity z Emmett i Axon Framework
- Addytywne — zero ryzyka breaking change

## Risks & Mitigations

**Risk**: AggregateRoot API zmieni sie w przyszlosci. **Mitigation**: GWT
builder zalezy tylko od `loadFromHistory()` i `getUncommittedEvents()` —
stabilne public API.

**Risk**: Event matching zbyt strict/loose. **Mitigation**: Structural matching
domyslnie + `matching()` helper dla partial.

**Risk**: Developers nie adoptuja GWT. **Mitigation**: Dokumentacja + LLMGUIDE +
migracja przykladow w consumer project.

## Alternatives Considered

### Alternative 1: Uzyc istniejacego BDD framework (cucumber-js)

**Rejected**: Overengineering — potrzebujemy fluent API, nie pelny BDD framework
z feature files.

### Alternative 2: Extend TestHarness z GWT methods

**Rejected**: TestHarness ma inny lifecycle (initialize/setup/teardown). GWT to
oddzielny concern.

### Alternative 3: Macro/decorator approach

**Rejected**: Zbyt magiczny, gorszy DX niz fluent builder.

---

**Author**: VytchesDDD Team **Approval**: Pending
