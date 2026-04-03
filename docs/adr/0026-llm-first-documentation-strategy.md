# ADR-0026: LLM-First Documentation Strategy

**Status**: Accepted **Date**: 2026-03-31 **Accepted**: 2026-04-03
**Supersedes**: Partially supersedes ADR-0024 CLI reduction decision
**Context**: Developer experience strategy — AI-assisted development over CLI
scaffolding **Implementation**: VF-014

## Problem Statement

Strategic maturity report (2026-03-31) ocenia dokumentacje na 4/10, a DX na
5/10. Glowny pain point: boilerplate ~330 LOC per command w consumer project.

Dotychczasowy plan zakladal CLI scaffolding (`generate aggregate/command/query`)
jako rozwiazanie. CLI ma jednak 26,135 LOC, nie dziala od miesiecy, wymaga
ciaglego utrzymania, i generuje generyczne szablony bez kontekstu projektu.

## Decision

**Zastapic strategie CLI scaffolding dokumentacja zoptymalizowana pod LLM
(Claude, Copilot, Cursor).**

### Dlaczego LLM docs > CLI scaffolding

| Aspekt            | CLI Scaffolding             | LLM Documentation                   |
| ----------------- | --------------------------- | ----------------------------------- |
| Koszt utrzymania  | Wysoki (kod + testy + docs) | Niski (tylko docs)                  |
| Kontekst projektu | Brak (generyczne szablony)  | Pelny (AI widzi caly projekt)       |
| Dostosowalnosc    | Ograniczona (flagi/opcje)   | Nieograniczona (natural language)   |
| Adoption barrier  | `npm install -g`, nauka CLI | Zero (kazdy juz uzywa AI)           |
| Aktualnosc        | Wymaga release per zmiana   | Natychmiastowa (czyta aktualny kod) |

### Struktura dokumentacji

```
docs/
  llm-context.md              # Master file — pelny overview API (~2000 LOC)
packages/
  contracts/LLMGUIDE.md       # Typy bazowe, Result<T>, interfejsy
  aggregates/LLMGUIDE.md      # AggregateRoot, capabilities, event sourcing
  value-objects/LLMGUIDE.md   # EntityId, ValueObject, custom VO
  cqrs/LLMGUIDE.md            # Commands, queries, handlers, bus
  events/LLMGUIDE.md          # Domain events, integration events
  validation/LLMGUIDE.md      # Specifications (class + INLINE!), policies
  repositories/LLMGUIDE.md    # Base repository, unit of work
  acl/LLMGUIDE.md             # Anti-corruption layer, adaptery
  policies/LLMGUIDE.md        # Policy builder, decision tables
```

### Format LLMGUIDE.md

Kazdy LLMGUIDE zawiera:

1. **Purpose** — 1-2 zdania co pakiet robi
2. **Quick Start** — minimalny przyklad uzycia (copy-paste ready)
3. **API Reference** — kluczowe klasy/funkcje z sygnaturami
4. **Patterns** — typowe wzorce uzycia z przykladami
5. **Anti-Patterns** — czeste bledy ktore AI popelnia
6. **Hidden Features** — rzeczy ktore istnieja ale sa malo znane (np. inline
   specs)

### Kluczowe odkrycie: Inline Specifications

Biblioteka juz wspiera inline specifications:

```typescript
const isAdult = Specification.create<User>(u => u.age >= 18);
const isVIP = CompositeSpecification.create<User>(u => u.totalSpent > 10000);
const canOrder = isAdult.and(isVIP);
```

To nie jest udokumentowane NIGDZIE. Consumer project ma 237 plikow specyfikacji,
z ktorych wiele mogloby byc inline. Samo udokumentowanie tego feature'a daje
wieksza wartosc niz budowanie CLI.

## Benefits

- **Universalnosc**: Dziala z kazdym AI assistant (Claude, Copilot, Cursor,
  ChatGPT)
- **Zero maintenance code**: Dokumentacja nie wymaga testow, build, release
- **Kontekstowe generowanie**: AI dostosowuje kod do istniejacego projektu
- **Odkrywalnosc**: Ukryte feature'y (inline specs) staja sie widoczne
- **ROI**: ~20h pracy vs ~80h CLI development + maintenance

## Risks & Mitigations

**Risk**: Dokumentacja sie dezaktualizuje. **Mitigation**: CI check na JSDoc
coverage, LLMGUIDE review przy kazdym major API change.

**Risk**: AI generuje niepoprawny kod mimo docs. **Mitigation**: Przyklady
kompilowane, anti-patterns sekcja, weryfikacja z prawdziwym LLM.

**Risk**: Nie kazdz developer uzywa AI. **Mitigation**: LLMGUIDE.md jest rowniez
dobra dokumentacja dla ludzi. Format jest czytelny niezaleznie od AI.

## Alternatives Considered

### Alternative 1: Naprawic CLI scaffolding

**Rejected**: 26K LOC, nie dziala od miesiecy, generyczne szablony bez
kontekstu. Koszt naprawy + utrzymania nieadekwatny do wartosci.

### Alternative 2: CLI + LLM docs rownoczesnie

**Rejected**: Ograniczone zasoby. LLM docs daja wieksza wartosc mniejszym
kosztem. CLI moze byc dodane pozniej jesli bedzie potrzebne.

### Alternative 3: Tylko JSDoc, bez LLMGUIDE

**Rejected**: JSDoc jest za granularny — AI potrzebuje high-level kontekstu
(wzorce, anti-patterns, relacje miedzy pakietami), nie tylko sygnatury metod.

## Success Metrics

- AI assistant generuje poprawny kod DDD w 8/10 przypadkow
- JSDoc coverage >= 80% (z 50%)
- Kazdy core package ma LLMGUIDE.md
- Developer onboarding z AI: <5 min

---

**Author**: VytchesDDD Team **Approval**: Pending
