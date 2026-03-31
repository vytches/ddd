# Task: LLM-Optimized Documentation

## Task Metadata

```yaml
task_id: 2026-03-31-014
title:
  LLM-Optimized Documentation - AI-first developer experience zamiast CLI
  scaffolding
type: documentation
priority: high
complexity: complex
estimated_time: 20h
created_by: human
created_at: 2026-03-31 13:30
status: planned
```

## Domain Context

```yaml
bounded_context: DeveloperExperience
aggregates: []
entities: []
value_objects: []
domain_events: []
patterns:
  - LLM-First Documentation
  - Context-Aware Examples
  - Prompt Engineering for Libraries
```

## Business Context

### Why This Task Exists

Strategic maturity report wskazal CLI scaffolding jako kluczowy gap (boilerplate
~330 LOC per command). Wlasciciel projektu podjal strategiczna decyzje:
**zamiast inwestowac w CLI scaffolding, stworzyc dokumentacje zoptymalizowana
pod LLM** (Claude, Copilot, Cursor).

Uzasadnienie:

- Kazdy developer uzywa AI assistants - to uniwersalne narzedzie
- CLI scaffolding wymaga utrzymania, dokumentacji, testow
- LLM docs daja wieksza wartosc mniejszym kosztem
- AI assistant moze generowac kod dostosowany do kontekstu projektu, nie
  generyczne szablony

Aktualny stan dokumentacji: **4/10** (strategic report). JSDoc coverage: **50%**
(822/1644 exports). Brakuje LLM tags, przykladow, kontekstu.

### Expected Business Value

- [ ] AI assistant potrafi poprawnie wygenerowac aggregate, command, query,
      event handler korzystajac z dokumentacji
- [ ] Czas onboardingu z AI: <5 min od `npm install` do dzialajacego kodu
- [ ] JSDoc coverage: 50% -> 80%+
- [ ] Odkrycie istniejacych ale nieudokumentowanych feature'ow (np. inline
      specifications)

### Success Metrics

- AI assistant (Claude/Copilot) generuje poprawny kod DDD z biblioteki w 8/10
  przypadkow
- JSDoc coverage >= 80% (1315/1644 exports)
- Kazdy package ma `LLMGUIDE.md` z kontekstem, przykladami i anti-patterns
- Istniejace ale nieznane API (inline specs, capability system) sa
  udokumentowane i odkrywalne

## Technical Context

### Current State

- JSDoc coverage: 50% (822/1644 exports documented)
- Brakujace LLM tags: 876
- Brakujace przyklady: 435
- Zero plikow LLMGUIDE.md
- Inline specifications istnieja (`Specification.create()`,
  `CompositeSpecification.create()`) ale nikt o nich nie wie
- Capability system agregatow nieudokumentowany
- Quality report score: docs 4/10

### Desired State

- Kazdy package ma `LLMGUIDE.md` - kompaktowy plik z kontekstem dla AI
- JSDoc na wszystkich publicznych eksportach z `@example`, `@see`, `@remarks`
- Root `docs/llm-context.md` - master dokument, ktory AI moze wczytac jednym
  plikiem
- Odkryte i udokumentowane "hidden gems" (inline specs, capabilities, policy
  builder)

### Technical Constraints

- Nie zmieniac kodu zrodlowego (tylko JSDoc i dokumentacja)
- Zachowac istniejacy system JSDoc injection (`jsdoc:inject:all`)
- Format LLMGUIDE.md musi byc parseable przez AI (markdown, strukturyzowany)
- Kazdy przyklad musi byc kompilujacy TypeScript (weryfikowalny)

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] Root `docs/llm-context.md` - master context file (~2000 LOC) z pelnym API
      overview
- [ ] `LLMGUIDE.md` dla kazdego core package (contracts, aggregates,
      value-objects, cqrs, events, validation, repositories, acl, policies)
- [ ] JSDoc coverage >= 80% na publicznych eksportach
- [ ] Sekcja "Hidden Features" dokumentujaca inline specs, capabilities, policy
      builder
- [ ] Anti-patterns sekcja w kazdym LLMGUIDE (czeste bledy AI)
- [ ] Przyklady "copy-paste ready" - kompilujacy TypeScript

### Non-Functional Requirements

- [ ] Performance: brak wplywu (tylko docs)
- [ ] Security: nie dokumentowac internal implementation details
- [ ] Documentation: to JEST dokumentacja
- [ ] Testing: kazdy przyklad w LLMGUIDE weryfikowany przez `tsc --noEmit`

### Definition of Done

- [ ] Root llm-context.md napisany
- [ ] LLMGUIDE.md w kazdym core package (minimum 9 pakietow)
- [ ] JSDoc coverage >= 80%
- [ ] Przyklady kompiluja sie
- [ ] AI test: Claude poprawnie generuje aggregate + command + handler z samej
      dokumentacji

## Implementation Plan

### Phase 1: Audit & Discovery

- **Tasks**:
  - [ ] Zidentyfikowac wszystkie publiczne API ktore brakuja JSDoc
  - [ ] Zidentyfikowac "hidden gems" - istniejace ale nieudokumentowane
        feature'y
  - [ ] Zdefiniowac format LLMGUIDE.md (template)
- **Output**: Lista eksportow do udokumentowania + template

### Phase 2: Core Package LLMGUIDEs

- **Tasks**:
  - [ ] LLMGUIDE.md dla contracts (typy bazowe, Result<T>, ISpecification)
  - [ ] LLMGUIDE.md dla aggregates (AggregateRoot, capabilities, event sourcing)
  - [ ] LLMGUIDE.md dla value-objects (EntityId, ValueObject, tworzenie custom
        VO)
  - [ ] LLMGUIDE.md dla cqrs (commands, queries, handlers, bus)
  - [ ] LLMGUIDE.md dla events (domain events, integration events, event store)
- **Output**: 5 core LLMGUIDEs

### Phase 3: Pattern Package LLMGUIDEs

- **Tasks**:
  - [ ] LLMGUIDE.md dla validation (specifications, inline specs!, policies)
  - [ ] LLMGUIDE.md dla repositories (base repository, unit of work)
  - [ ] LLMGUIDE.md dla acl (anti-corruption layer, adaptery)
  - [ ] LLMGUIDE.md dla policies (policy builder, decision tables)
- **Output**: 4 pattern LLMGUIDEs

### Phase 4: Master Context & JSDoc

- **Tasks**:
  - [ ] Root `docs/llm-context.md` - master file laczacy wszystko
  - [ ] JSDoc gap filling - pokrycie brakujacych 740+ eksportow
  - [ ] Weryfikacja przykladow (`tsc --noEmit`)
- **Output**: Kompletna dokumentacja LLM-ready

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

| Risk                            | Probability | Impact | Mitigation                       |
| ------------------------------- | ----------- | ------ | -------------------------------- |
| Przyklady nie kompiluja sie     | Medium      | High   | Weryfikacja tsc na kazdym uzyciu |
| JSDoc injection psuje build     | Low         | Medium | Test build po kazdym uzyciu      |
| Dokumentacja sie dezaktualizuje | Medium      | Medium | CI check na JSDoc coverage       |
| AI generuje zly kod mimo docs   | Low         | Medium | AI test z prawdziwym LLM         |

## Related ADR

- ADR-0025: LLM-First Documentation Strategy

---

_Task managed by Project Orchestrator | Created: 2026-03-31_
