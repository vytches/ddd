# ADR-0030: Event Payload API Stability Contract

**Status**: Proposed **Date**: 2026-03-31 **Supersedes**: None **Context**:
Prevent future breaking migrations in event payload API **Implementation**:
VF-018

## Problem Statement

Niedawna zmiana `getBusinessData()` → `payload.businessData` wymusila
aktualizacje 168+ plikow w consumer project. Brak formalnego kontraktu co jest
stable API a co experimental/internal sprawia ze kazdy upgrade jest ryzykowny.

## Decision

**Wprowadzic formalne stability tags i API surface monitoring.**

### Stability Levels

| Tag             | Znaczenie                                        | Breaking Change Policy                      |
| --------------- | ------------------------------------------------ | ------------------------------------------- |
| `@stable`       | Production API, gwarantowane do nastepnego major | Tylko w major version, z deprecation period |
| `@experimental` | Moze sie zmienic w minor version                 | Warning w changelog                         |
| `@internal`     | Implementacja, nie uzywac w consumer code        | Moze sie zmienic bez ostrzezenia            |

### Enforcement

1. **JSDoc tags** na kazdym publicznym eksporcie
2. **Microsoft API Extractor** generuje `.api.md` baseline
3. **CI check** blokuje PR ktory zmienia `@stable` API bez major version bump
4. **Changelog** automatycznie flaguje zmiany w `@experimental` API

### Scope

Zaczynamy od pakietu `events` (bo tam byl problem), potem rozszerzamy na
`contracts`, `aggregates`, `cqrs`.

## Benefits

- Consumer project wie co jest bezpieczne do uzycia
- CI lapie przypadkowe breaking changes
- Deprecation warnings zamiast naglyych zmian
- Zaufanie do biblioteki

## Risks & Mitigations

**Risk**: API Extractor false positives. **Mitigation**: Dobrze sklasyfikowac
`@internal` - internal changes nie sa flagowane.

---

**Author**: VytchesDDD Team **Approval**: Pending
