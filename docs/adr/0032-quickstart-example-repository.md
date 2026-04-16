# ADR-0032: Quickstart Example Repository

**Status**: Proposed **Date**: 2026-03-31 **Supersedes**: None **Context**: <5
minute onboarding with working reference implementation **Implementation**:
VF-020

## Problem Statement

Biblioteka ma 21 pakietow ale ZERO dzialajacego przykladu end-to-end. Developer
musi:

1. Czytac README kazdego pakietu osobno
2. Zgadywac jak pakiety wspolpracuja
3. Pisac boilerplate od zera

Consumer project (juz-ide-api, 16K testow, 237 agregatow) jest za duzy zeby
sluzyc jako przyklad. Onboarding trwa 15+ minut z "analysis paralysis".

## Decision

**Stworzyc minimalny ale kompletny przyklad w `examples/quickstart/` w
monorepo.**

### Scope: E-Commerce Order Domain

Prosty ale realistyczny domain ktory demonstruje wszystkie key patterns:

| Pattern           | Przyklad                                         |
| ----------------- | ------------------------------------------------ |
| AggregateRoot     | Order (create, addItem, place, cancel)           |
| ValueObject       | Money (amount + currency, validation)            |
| DomainEvent       | OrderPlaced, OrderCancelled                      |
| Command + Handler | CreateOrderCommand                               |
| Query + Handler   | GetOrderQuery                                    |
| Specification     | Inline: `Specification.create(o => o.total > 0)` |
| Repository        | InMemoryOrderRepository                          |

### Zasady

1. **Tylko `@vytches/ddd-enterprise`** jako dependency (meta-package)
2. **Zero infrastruktury** (bez DB, bez frameworka, bez HTTP)
3. **<500 LOC** (bez testow)
4. **Inline specs** (nie class-based - promowac lepszy pattern)
5. **`npm install && npm test`** dziala w <2 minuty

### Dlaczego w monorepo a nie osobne repo

- Latwo utrzymac synchronizacje z biblioteka
- CI testuje przyklad przy kazdym PR
- Nie wymaga publish do npm zeby dzialac
- Developer moze sklonowac monorepo i od razu uruchomic

## Benefits

- Onboarding <5 minut
- Reference implementation do kopiowania
- LLM moze wczytac caly przyklad (~500 LOC) i generowac kod w stylu
- CI weryfikuje ze przyklad kompiluje sie z aktualna wersja biblioteki

## Risks & Mitigations

**Risk**: Przyklad sie dezaktualizuje. **Mitigation**: CI kompiluje i testuje
przyklad przy kazdym PR.

**Risk**: Zbyt prosty - nie pokazuje prawdziwej wartosci. **Mitigation**: Order
domain jest realistyczny. Dodac komentarze "w prawdziwym projekcie tutaj
bylby...".

---

**Author**: VytchesDDD Team **Approval**: Pending
