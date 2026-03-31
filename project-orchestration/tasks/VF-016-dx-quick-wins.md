# Task: Developer Experience Quick Wins

## Task Metadata

```yaml
task_id: 2026-03-31-016
title: DX Quick Wins - inline specs discovery, branded types, auto-discovery
type: refactor
priority: normal
complexity: medium
estimated_time: 10h
created_by: human
created_at: 2026-03-31 13:30
status: planned
```

## Domain Context

```yaml
bounded_context: DeveloperExperience
aggregates: []
entities: []
value_objects:
  - EntityId
domain_events: []
patterns:
  - Inline Specifications
  - Branded Types
  - Auto-Discovery
  - Convenience API
```

## Business Context

### Why This Task Exists

Strategic maturity report zidentyfikowal DX score jako 5/10. Kilka quick wins
moze podniesc go znaczaco bez breaking changes:

1. **Inline specifications** - juz istnieja (`Specification.create()`,
   `CompositeSpecification.create()`) ale sa nieodkrywalne. Consumer project ma
   237 plikow specyfikacji, z ktorych wiele to 20-30 LOC one-use specs, ktore
   moglyby byc inline.
2. **Branded types dla EntityId** - aktualnie `EntityId` to wrapper, ale nie ma
   branded types (`OrderId`, `CustomerId`) ktore daja compile-time safety.
3. **ACL auto-discovery** - manualna rejestracja adapterow ACL, brak
   auto-discovery.

Te zmiany sa addytywne (nie-breaking) i daja natychmiastowa wartosc.

### Expected Business Value

- [ ] Inline specs: redukcja plikow specyfikacji o 50-70% w consumer project
- [ ] Branded types: compile-time bledy przy pomyleniu OrderId z CustomerId
- [ ] Auto-discovery: mniej boilerplate'u przy rejestracji ACL adapterow
- [ ] Lepsze DX score: 5/10 -> 7/10

### Success Metrics

- Inline specs udokumentowane i odkrywalne (LLMGUIDE, JSDoc, przyklady)
- Branded EntityId types z type-safety (expect-type tests)
- ACL auto-discovery dziala out-of-the-box z dekoratorem lub konwencja

## Technical Context

### Current State

**Inline specs** - istnieja ale ukryte:

```typescript
// To juz dziala, ale nikt o tym nie wie:
const isAdult = Specification.create<User>(u => u.age >= 18);
const isActive = CompositeSpecification.create<User>(
  u => u.status === 'active'
);
```

**EntityId** - brak branded types:

```typescript
// Aktualnie: oba to EntityId, mozna je pomylic
const orderId = EntityId.create('order-1');
const customerId = EntityId.create('customer-1');
// BRAK BLEDU: assignOrder(customerId) - powinien byc compile error
```

**ACL** - manualna rejestracja:

```typescript
// Aktualnie: trzeba recznie rejestrowac kazdy adapter
aclRegistry.register('payments', new PaymentACLAdapter());
aclRegistry.register('shipping', new ShippingACLAdapter());
```

### Desired State

**Inline specs** - udokumentowane, convenience helpers:

```typescript
// Juz dziala, ale teraz udokumentowane + dodatkowe helpery
const isAdult = Specification.create<User>(u => u.age >= 18);
const isVIP = Specification.create<User>(u => u.totalSpent > 10000);
const canOrder = isAdult.and(isVIP);
```

**Branded types**:

```typescript
type OrderId = BrandedId<'Order'>;
type CustomerId = BrandedId<'Customer'>;
// COMPILE ERROR: assignOrder(customerId: CustomerId) <- OrderId expected
```

**ACL auto-discovery**:

```typescript
// Adapter rejestruje sie sam przez dekorator lub konwencje
@ACLAdapter('payments')
class PaymentACLAdapter implements IACLAdapter { ... }
```

### Technical Constraints

- Wszystkie zmiany musza byc addytywne (nie-breaking)
- Branded types musza dzialac z istniejacym EntityId
- Auto-discovery nie moze wymagac runtime reflection (library, nie framework)
- Zachowac tree-shaking (nie importowac calego validation w aggregates)

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] Inline specs: comprehensive JSDoc + LLMGUIDE documentation
- [ ] Inline specs: dodatkowe convenience factory methods jesli brakuje
- [ ] Branded EntityId: `BrandedId<Tag>` type utility
- [ ] Branded EntityId: factory `createId<Tag>(value)` z type narrowing
- [ ] ACL auto-discovery: dekorator `@ACLAdapter(contextName)` lub registry
      pattern
- [ ] ACL auto-discovery: `aclRegistry.discoverAdapters()` method

### Non-Functional Requirements

- [ ] Performance: zero runtime overhead dla branded types (compile-time only)
- [ ] Security: brak wplywu
- [ ] Documentation: kazda zmiana udokumentowana w LLMGUIDE
- [ ] Testing: expect-type tests dla branded types, unit tests dla
      auto-discovery

### Definition of Done

- [ ] Inline specs w pelni udokumentowane + przyklady
- [ ] Branded types zaimplementowane + type tests
- [ ] ACL auto-discovery zaimplementowane + testy
- [ ] Wszystkie istniejace testy passing
- [ ] LLMGUIDE.md zaktualizowane

## Implementation Plan

### Phase 1: Inline Specs Documentation

- **Tasks**:
  - [ ] Audit istniejacych inline spec capabilities
  - [ ] Napisac comprehensive dokumentacje z przykladami
  - [ ] Dodac convenience helpers jesli brakuje (np.
        `Specification.fromPredicate()`)
  - [ ] Dodac przyklady migracji z class-based na inline
- **Output**: Odkrywalna dokumentacja inline specs

### Phase 2: Branded EntityId Types

- **Tasks**:
  - [ ] Zaprojektowac `BrandedId<Tag>` type utility
  - [ ] Zaimplementowac factory functions z type narrowing
  - [ ] Dodac expect-type tests
  - [ ] Zaktualizowac EntityId documentation
- **Output**: Type-safe ID system

### Phase 3: ACL Auto-Discovery

- **Tasks**:
  - [ ] Zaprojektowac auto-discovery pattern (dekorator vs convention)
  - [ ] Zaimplementowac w `packages/acl`
  - [ ] Testy unit + integration
  - [ ] Dokumentacja
- **Output**: Zero-config ACL adapter registration

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

| Risk                                       | Probability | Impact | Mitigation                               |
| ------------------------------------------ | ----------- | ------ | ---------------------------------------- |
| Branded types conflict z EntityId          | Low         | Medium | Prototyp wczesnie, expect-type           |
| Auto-discovery wymaga DI framework         | Medium      | Medium | Design bez reflection, pure TS           |
| Inline specs mniej wydajne niz class-based | Low         | Low    | Benchmark, roznica powinna byc minimalna |

## Related ADR

- ADR-0027: Developer Experience Quick Wins Strategy

---

_Task managed by Project Orchestrator | Created: 2026-03-31_
