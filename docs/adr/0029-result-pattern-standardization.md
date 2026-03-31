# ADR-0029: Result<T,E> Pattern Standardization

**Status**: Proposed **Date**: 2026-03-31 **Supersedes**: None **Context**:
Consistent error handling across all library packages **Implementation**: VF-017

## Problem Statement

Biblioteka uzywa trzech roznych pattern'ow obslugi bledow w publicznym API:

1. **Result<T,E>** - poprawny, uzywany w czesci factory methods
2. **Throw exceptions** - uzywany w czesci command methods i konstruktorow
3. **T | null** - uzywany w czesci query/repository methods

Consumer project nie wie ktory pattern uzywa dana metoda bez czytania
implementacji. To prowadzi do:

- Niespojnego error handling w aplikacji
- Brakujacych try/catch (bo developer zaklada Result)
- Nieobsluzonych Result (bo developer zaklada throw)

## Decision

**Standaryzowac caly publiczny API na Result<T,E>. Domain layer nigdy nie rzuca
wyjatkow.**

### Konwencja

```typescript
// Factory methods: Result<T, ValidationError>
static create(props: Props): Result<MyVO, ValidationError>

// Command methods: Result<void, DomainError>
addItem(item: Item): Result<void, DomainError>

// Query methods: Result<T, NotFoundError>
findById(id: EntityId): Result<T, NotFoundError>

// Constructors: private (force factory usage)
private constructor(props: Props) { ... }
```

### Migration Path

Zmiana return type z `void` (throws) na `Result<void, E>` jest **breaking
change**. Plan migracji:

1. **Phase A**: Dodac nowe metody z suffixem `Safe` obok starych: `addItem()`
   (throws) + `addItemSafe()` (Result)
2. **Phase B**: Oznaczyc stare metody `@deprecated`
3. **Phase C**: W major version usunac stare metody, rename Safe → base name

Alternatywnie, jesli VF-013 (simplification) przygotowuje major version bump,
mozna zmienic od razu.

## Benefits

- Jeden pattern w calej bibliotece
- Developer zawsze wie co dostanie (Result)
- Compile-time enforcement: Result musi byc obsluzony
- Lepsza integracja z functional programming patterns

## Risks & Mitigations

**Risk**: Breaking change w aggregate command methods. **Mitigation**: Dual API
period (Safe suffix) lub synchronizacja z major version.

**Risk**: Performance overhead Result vs throw. **Mitigation**: Result
allocation jest tansza niz throw (no stack trace capture). Benchmark to
potwierdzi.

---

**Author**: VytchesDDD Team **Approval**: Pending
