# ADR-0028: Developer Experience Quick Wins

**Status**: Proposed **Date**: 2026-03-31 **Supersedes**: None **Context**:
Additive DX improvements — branded types, inline specs discovery, ACL
auto-discovery **Implementation**: VF-016

## Problem Statement

Strategic maturity report ocenia DX na 5/10. Trzy szybkie usprawnienia moga
podniesc go do 7/10 bez breaking changes:

1. **Inline specifications sa nieodkrywalne** — `Specification.create()` i
   `CompositeSpecification.create()` istnieja, ale nie sa udokumentowane.
   Consumer project ma 237 plikow specyfikacji, wiele z nich to 20-30 LOC
   one-use specs.

2. **Brak branded types dla EntityId** — `OrderId` i `CustomerId` sa tym samym
   typem, kompilator nie wykrywa pomylek.

3. **Manualna rejestracja ACL adapterow** — kazdy adapter musi byc recznie
   zarejestrowany, brak auto-discovery.

## Decision

### 1. Inline Specifications: Documentation + Convenience API

**Nie** tworzymy nowego API — dokumentujemy istniejace i dodajemy convenience
helpers:

```typescript
// Juz istnieje:
const isAdult = Specification.create<User>(u => u.age >= 18);

// Dodajemy helper do migracji z class-based:
// BEFORE: 30 LOC file
export class IsAdultSpecification extends CompositeSpecification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.age >= 18;
  }
}

// AFTER: 1 linia
export const isAdult = Specification.create<User>(u => u.age >= 18);
```

### 2. Branded EntityId Types

```typescript
// Nowy type utility w @vytches/ddd-value-objects
declare const __brand: unique symbol;
type BrandedId<Tag extends string> = EntityId & { readonly [__brand]: Tag };

// Factory
function createId<Tag extends string>(value: string): BrandedId<Tag> {
  return EntityId.create(value) as BrandedId<Tag>;
}

// Usage
type OrderId = BrandedId<'Order'>;
type CustomerId = BrandedId<'Customer'>;

const orderId = createId<'Order'>('order-123');
const customerId = createId<'Customer'>('cust-456');

function processOrder(id: OrderId): void { ... }
processOrder(customerId); // COMPILE ERROR
```

**Zero runtime overhead** — branding istnieje tylko w typach.

### 3. ACL Auto-Discovery

Pattern oparty o registry bez runtime reflection (bo to library, nie framework):

```typescript
// Deklaratywna rejestracja
const paymentAdapter = ACLAdapter.define({
  context: 'payments',
  adapter: PaymentACLAdapter,
});

// Auto-discovery z tablicy
const registry = ACLRegistry.fromAdapters([
  paymentAdapter,
  shippingAdapter,
  notificationAdapter,
]);

// Zamiast:
const registry = new ACLRegistry();
registry.register('payments', new PaymentACLAdapter());
registry.register('shipping', new ShippingACLAdapter());
registry.register('notifications', new NotificationACLAdapter());
```

## Benefits

- Wszystkie 3 zmiany sa addytywne (nie-breaking)
- Zero runtime overhead dla branded types
- Inline specs: discovery bez nowego kodu
- ACL: mniej boilerplate'u, deklaratywna konfiguracja
- DX score: 5/10 -> 7/10

## Risks & Mitigations

**Risk**: Branded types moga byc confusing dla juniorow. **Mitigation**:
Opcjonalne — istniejacy EntityId nadal dziala. Branding to opt-in.

**Risk**: ACL auto-discovery zbyt magiczne. **Mitigation**: Pattern
`ACLAdapter.define()` + `ACLRegistry.fromAdapters()` jest explicit, nie magic.

## Alternatives Considered

### Alternative 1: Nominal types zamiast branded

**Rejected**: Wymaga `class OrderId extends EntityId` — runtime overhead +
breaking change.

### Alternative 2: Decorator-based ACL discovery

**Rejected**: Wymaga reflection/metadata — to library, nie framework. Dekoratory
z reflect-metadata sa anti-pattern w library.

---

**Author**: VytchesDDD Team **Approval**: Pending
