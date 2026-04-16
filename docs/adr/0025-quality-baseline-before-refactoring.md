# ADR-0025: Quality Baseline Before Refactoring

**Status**: Proposed **Date**: 2026-03-31 **Supersedes**: None **Context**:
Stabilize CI and portability before major refactors **Implementation**: VF-012

## Problem Statement

Przed rozpoczeciem refaktorow i nowych feature'ow, baza kodu ma dwa problemy
podwazajace zaufanie do CI:

1. **Flaky performance test** -
   `packages/nestjs/tests/realistic-enterprise-integration.test.ts` sprawdza
   `registrationTime > 1ms`, ale na szybszym hardware rejestracja trwa ~0.47ms.
   Test losowo failuje.
2. **Hardcoded absolute paths** - dwa pliki zawieraja
   `/opt/projects/vytches-ddd/...`, co uniemozliwia prace na innej maszynie bez
   recznej edycji.

## Decision

**Naprawic oba problemy jako warunek wstepny do dalszych prac.**

### Fix 1: Performance Test Thresholds

Zmiana asercji z:

```typescript
expect(registrationTime).toBeGreaterThan(1); // fails on fast hardware
expect(registrationTime).toBeLessThan(500);
```

Na:

```typescript
expect(registrationTime).toBeGreaterThanOrEqual(0); // always true, service ran
expect(registrationTime).toBeLessThan(500); // still catches regressions
```

**Rationale**: Dolny prog nie ma sensu - nie testujemy czy cos jest
_wystarczajaco wolne_. Gorny prog (500ms) wystarczy do wykrywania regresji.

### Fix 2: Relative Paths

Zamiana:

```typescript
// BEFORE
const path = '/opt/projects/vytches-ddd/docs/examples/domain/...';

// AFTER
const path = resolve(__dirname, '../../docs/examples/domain/...');
```

**Rationale**: Projekt musi dzialac na dowolnej maszynie bez konfiguracji.

## Benefits

- 100% testow passing stabilnie na dowolnym hardware
- Projekt portable miedzy maszynami / CI runners
- Czysta baza do VF-013, VF-014, VF-015, VF-016

## Risks & Mitigations

**Risk**: Zbyt luźny performance test nie wykryje regresji. **Mitigation**:
Gorny prog 500ms nadal chroni przed grubymi regresjami. Jesli potrzebny
dokladniejszy benchmark, powinien byc osobnym narzedziem (nie unit test).

## Alternatives Considered

### Alternative 1: Skip flaky test

**Rejected**: Ukrywa problem, nie rozwiazuje go.

### Alternative 2: Environment variable for paths

**Rejected**: Overengineering - relative paths wystarczaja.

---

**Author**: VytchesDDD Team **Approval**: Pending
