# Task: Fix per-context CQRS bus — handler registration + cross-context ACL bus

## Task Metadata

```yaml
task_id: VP-009
title:
  Fix FeatureHandlerRegistrar.findOwnModule() + GLOBAL_QUERY_BUS/GLOBAL_COMMAND_BUS
  for ACL + Symbol.for DI tokens (dual-package hazard)
type: bug
priority: high
complexity: medium
estimated_time: 9h
created_by: agent
created_at: 2026-05-29 00:00
status: planned
```

## Domain Context

```yaml
bounded_context: CommandHandling / NestJS Integration
aggregates: []
entities: []
value_objects: []
domain_events: []
patterns:
  - CQRS bus isolation (per-context)
  - Anti-Corruption Layer (ACL) cross-context queries
  - Dynamic module / DI token resolution
```

## Business Context

### Why This Task Exists

Feedback z konsumenta `juz-ide-api` (10+ bounded contexts) ujawnił **trzy realne
bugi** w `@vytches/ddd-nestjs`, mechanizmie per-context CQRS bus isolation
wprowadzonym w VP-007 (ADR-0034):

1. **Bug #1 — feature bus zostaje pusty.** `VytchesDDDModule.forFeature(ctx)`
   nie rejestruje handlerów contextu w izolowanym busie → command/query handlery
   nie są wywoływalne przez feature bus. Izolacja kontekstów de facto nie
   działa.

2. **Bug #2 — brak globalnego busa dla ACL.** `forFeature()` nadpisuje
   `IQueryBus`/`ICommandBus` w scope modułu konsumenta, więc `ContextAPI` (ACL,
   z definicji cross-context) dostaje feature-scoped bus i nie może wykonywać
   zapytań cross-context. Biblioteka rozwiązała ten problem dla eventów
   (`LOCAL_EVENT_BUS` vs `IEventBus`), ale brak analogicznej symetrii dla CQRS.

3. **Bug #3 — dual-package hazard (ESM↔CJS) rozłącza tokeny DI.**
   `IQueryBus`/`ICommandBus` to abstrakcyjne klasy używane jako tokeny `@Inject`.
   Pakiety są dual-format; gdy ten sam pakiet załaduje się jako ESM i CJS (np.
   Vitest: kod ESM + nestjs przez `require`/CJS), powstają dwa różne obiekty
   klasy → DI nie matchuje → `@Optional()` daje `undefined` → query handlery po
   cichu pomijane → brak handlera → 503. Zgłoszone przez juz-ide-api.

### Expected Business Value

- [ ] Per-context CQRS isolation faktycznie działa u konsumentów (VP-007
      dowieziony)
- [ ] ACL cross-context queries działają bez obejść w kodzie konsumenta
- [ ] Wzmocniona reputacja biblioteki (najbardziej kompleksowa lib DDD w TS)

### Success Metrics

- Test reprodukcyjny RED → GREEN dla obu bugów
- `juz-ide-api` potwierdza działanie po bumpie wersji
- Zero breaking changes w publicznym API (patch/minor)

## Technical Context

### Current State

**Bug #1** — `FeatureHandlerRegistrar.findOwnModule()`
(`packages/nestjs/src/feature/feature-handler-registrar.ts:92-99`):

```ts
private findOwnModule(): Module | undefined {
  for (const [, mod] of this.modulesContainer.entries()) {
    if (mod.providers.has(this.anchorToken as unknown as never)) {
      return mod;          // ← zwraca VytchesDDDFeatureModule (ma anchor, 0 handlerów)
    }
  }
  return undefined;
}
```

`forFeature()` rejestruje `anchorToken` w providers **samego
VytchesDDDFeatureModule**, a handlery konsumenta żyją w providers modułu
importującego (np. `PricingModule`). `extractHandlers()` skanuje zły moduł → 0
handlerów → feature bus pusty.

**Bug #2** — `vytches-ddd-feature.module.ts:81` eksportuje
`IQueryBus`/`ICommandBus`, co w hierarchii DI NestJS zacienia globalne instancje
dla **każdego** providera modułu importującego, w tym dla `ContextAPI` (ACL).

**Bug #3** — `IQueryBus`/`ICommandBus` to `export abstract class`
(`packages/cqrs/src/abstracts/{query,command}-bus.abstract.ts:6`) używane jako
tokeny DI. Przy dual-loadingu ESM/CJS tożsamość klasy się rozjeżdża. Cichy
łańcuch: `@Optional() @Inject(IQueryBus) queryBus?`
(`vytches-explorer.service.ts:86`) → `undefined`; guard `&& this.queryBus`
(`:371`) → query handlery pominięte. UWAGA: `queryBus===undefined` ma dwa źródła
— (a) ten hazard, (b) brak globalnego providera busa (= Bug #2); wymagany test
rozróżniający przed wyborem fixu.

### Desired State

- **Bug #1:** `findOwnModule()` zwraca moduł konsumenta (ten, który importuje
  feature module), więc `extractHandlers()` znajduje handlery.
- **Bug #2:** dostępne tokeny `GLOBAL_QUERY_BUS` / `GLOBAL_COMMAND_BUS`
  rozwiązujące się zawsze do root-instancji (nie nadpisywane przez
  `forFeature()`), by ACL mógł je wstrzyknąć dla cross-context.
- **Bug #3:** injection oparte na stabilnych tokenach (`Symbol.for(...)`) zamiast
  referencji klas abstrakcyjnych → DI matchuje niezależnie od ESM/CJS.

### Technical Constraints

- Backward compatibility: bez breaking change w `index.ts` exports
- Dependency-free: zero nowych zależności runtime
- Polega na internalach NestJS (`ModulesContainer`, `Module.imports`) —
  udokumentować

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] **Bug #1:** handlery contextu zarejestrowane w feature busie po
      `forFeature()`
- [ ] **Bug #1:** mapping feature-module → moduł importujący działa 1:1
- [ ] **Bug #2:** `GLOBAL_QUERY_BUS` / `GLOBAL_COMMAND_BUS` dostępne i zawsze
      globalne
- [ ] **Bug #2:** wstrzyknięcie `GLOBAL_QUERY_BUS` w module z `forFeature()`
      zwraca root bus
- [ ] **Bug #3:** test diagnostyczny rozróżniający dual-package hazard od
      missing-provider
- [ ] **Bug #3:** decyzja o strategii tokenów (klasy → `Symbol.for`) z oceną
      backward-compat dla istniejących `@Inject(IQueryBus)`

### Non-Functional Requirements

- [ ] Performance: bootstrap O(N·M) akceptowalne (zweryfikowane: ~pomijalne dla
      10 kontekstów)
- [ ] Security: brak — analiza nie wykazała powierzchni ataku
- [ ] Documentation: ADR-0034 zaktualizowane o oba defekty + symetria CQRS
- [ ] Testing: test RED reprodukujący każdy bug przed fixem (TDD)

### Definition of Done

- [ ] Kod zaimplementowany i zreviewowany (library-quality-verifier)
- [ ] Testy napisane i przechodzą (>80% coverage nowego kodu)
- [ ] ADR-0034 zaktualizowane
- [ ] Brak breaking changes (library-api-guardian potwierdza)
- [ ] Changeset dodany

## Decyzje projektowe (z analizy 4 agentów + weryfikacja źródła NestJS 11)

```yaml
wariant_B_eksport_anchora:
  status: ODRZUCONY
  powod: >
    Zweryfikowano w @nestjs/core/injector/module.js — eksportowany provider
    trafia do _exports (Set), NIE do _providers modułu importującego.
    mod.providers.has(anchorToken) na konsumencie = false. Bug NIE zniknie.
    (Autor feedbacku miał błędny model DI NestJS.)

wariant_A_traversal_imports:
  status: REKOMENDOWANY (fix natychmiastowy)
  powod: >
    Zweryfikowano: container.js rozwiązuje DynamicModule do instancji Module,
    module.js:341 addImport() trzyma instancje Module w _imports (Set).
    mod.imports.has(featureModule) niezawodne. O(1) lookup, perf pomijalna.
  koszt: pogłębia zależność od internala NestJS (Module.imports) — udokumentować

wariant_C_explicit_handler_list:
  status: OPCJONALNY (strategiczny, follow-up)
  powod: >
    forFeature(ctx, { handlers: [...] }) wzorem @nestjs/cqrs v10 — eliminuje
    findOwnModule/extractHandlers/anchor całkowicie. Większa zmiana API, dodaje
    boilerplate, kłóci się z wartością auto-discovery. Rozważyć jako opcjonalny
    overload zachowujący wsteczną kompatybilność.
```

## Implementation Plan

### Phase 1: Bug #1 — handler registration (Wariant A)

- **Agent**: library-expert (impl) + library-quality-verifier (VETO)
- **Tasks**:
  - [ ] Test RED: `forFeature()` z handlerem w module importującym → feature bus
        pusty
  - [ ] `findOwnModule()`: znajdź feature module po `anchorToken`, potem moduł z
        `mod.imports.has(featureModule)` → zwróć konsumenta
  - [ ] Komentarz dokumentujący zależność od `Module.imports` (internal NestJS)
  - [ ] Test GREEN + edge case (brak importera → graceful warn jak dziś)
- **Output**: działająca rejestracja handlerów, testy

### Phase 2: Bug #2 — GLOBAL_QUERY_BUS / GLOBAL_COMMAND_BUS

- **Agent**: ddd-patterns-expert (design) + library-expert (impl)
- **Tasks**:
  - [ ] Dodać tokeny do `packages/nestjs/src/constants.ts`, eksport w barrel
  - [ ] W root `VytchesDDDModule`:
        `{ provide: GLOBAL_QUERY_BUS, useExisting: IQueryBus }` (analogicznie
        command) — NIE eksportowane/nadpisywane przez `forFeature()`
  - [ ] Test: wstrzyknięcie `GLOBAL_QUERY_BUS` w module z `forFeature()` = root
        bus
  - [ ] Symetria do `LOCAL_EVENT_BUS` vs `IEventBus` (wzorzec z dispatcher)
- **Output**: tokeny + testy + przykład ACL

### Phase 3: Bug #3 — DI token identity (dual-package hazard)

- **Agent**: backend-technology-expert (analiza ESM/CJS) + library-api-guardian
  (backward-compat tokenów) + library-expert (impl)
- **Tasks**:
  - [ ] Test diagnostyczny: zdjąć `@Optional()` z `@Inject(IQueryBus)` →
        rozróżnić hazard (provider jest, Nest rzuca „can't resolve") od
        missing-provider (brak providera = teren Bug #2)
  - [ ] Decyzja: tokeny `Symbol.for('vytches:cqrs:query-bus')` zamiast referencji
        klas abstrakcyjnych (odporne na dual-loading; spójne z anchorem
        `forFeature`, który już używa `Symbol.for`)
  - [ ] Ocena backward-compat: czy `@Inject(IQueryBus)` jako klasa pozostaje
        wstecznie kompatybilny? Rozważyć klasę jako alias na Symbol.for
        (library-api-guardian)
  - [ ] Nota dla konsumenta: `server.deps.inline: ['@vytches']` w vitest jako
        mitygacja TEST-only (nie rusza produkcji)
- **Output**: decyzja o tokenach + test diagnostyczny + nota dla konsumenta

### Phase 4: Docs

- **Agent**: documentation-master
- **Tasks**:
  - [ ] ADR-0034: dopisać sekcję o obu defektach + decyzja o symetrii CQRS
  - [ ] Przykład: ContextAPI używa `@Inject(GLOBAL_QUERY_BUS)` dla cross-context
  - [ ] Changeset
- **Output**: zaktualizowana dokumentacja

## Code References

### Files to Modify

```yaml
packages:
  - package: '@vytches/ddd-nestjs'
    files:
      - src/feature/feature-handler-registrar.ts # Bug #1 — findOwnModule
      - src/feature/vytches-ddd-feature.module.ts # Bug #2 — bus tokens
      - src/vytches-ddd.module.ts # Bug #2 — root GLOBAL_*_BUS
      - src/constants.ts # Bug #2 — nowe tokeny
      - src/index.ts # Bug #2 — eksport tokenów
      - tests/feature/feature-handler-registrar.test.ts # Bug #1 — test RED→GREEN
      - tests/feature/global-bus-acl.test.ts # Bug #2 — nowy test
  - package: '@vytches/ddd-cqrs'
    files:
      - src/abstracts/query-bus.abstract.ts # Bug #3 — token strategy (Symbol.for)
      - src/abstracts/command-bus.abstract.ts # Bug #3 — token strategy
```

### Related PRs/Commits

- ADR-0034: `docs/adr/0034-per-context-cqrs-bus-isolation.md`

## Risk Assessment

### Technical Risks

| Risk                                 | Probability | Impact | Mitigation                                                |
| ------------------------------------ | ----------- | ------ | --------------------------------------------------------- |
| `Module.imports` zmieni się w NestJS | Med         | Med    | Komentarz + test integracyjny na realnym module graph     |
| Double-import jednego forFeature()   | Low         | Low    | Unikalny Symbol per-call → 1:1; udokumentować jako misuse |
| Breaking change w API                | Low         | High   | library-api-guardian review przed merge                   |
| Zmiana tokenów (klasy→Symbol.for) łamie `@Inject(IQueryBus)` u konsumentów | Med | High | Zachować klasę jako alias na Symbol.for; library-api-guardian review |
| Dual-package hazard także w produkcji (nie tylko Vitest) | Med | High | `deps.inline` to fix TEST-only; Symbol.for naprawia oba środowiska |

## Testing Strategy

### Unit Tests

- [ ] Bug #1: handler w module importującym → zarejestrowany w feature busie
- [ ] Bug #1: brak modułu importującego → graceful warn (bez crashu)
- [ ] Bug #2: `GLOBAL_QUERY_BUS` w scope `forFeature()` zwraca root instancję
- [ ] Bug #2: feature `IQueryBus` ≠ `GLOBAL_QUERY_BUS` (różne instancje)
- [ ] Bug #3: diagnostyczny — provider zarejestrowany, ale `@Inject(IQueryBus)`
      bez `@Optional` rzuca → potwierdza token-identity mismatch (hazard), nie
      missing-provider

### Integration Tests

- [ ] Pełny module graph: 2 konteksty + ACL cross-context query

## Links & References

### Related Tasks

- VP-007: per-context-cqrs-buses (funkcja, w której są bugi)
- VP-008: outbox-fanout-default-handler

### External Resources

- ADR-0034 per-context CQRS bus isolation
- @nestjs/cqrs v10 `CqrsModule.forFeature({ commandHandlers, queryHandlers })` —
  wzorzec Wariantu C
- Weryfikacja: `@nestjs/core@11.1.19` `injector/module.js`
  (`_providers`/`_exports`/`_imports`), `injector/container.js` (`addImport`)

## Final Notes

Analizę przeprowadzili: library-api-guardian, architecture-guardian,
ddd-patterns-expert, performance-optimizer. Diagnoza konsumenta poprawna co do
Bug #1, ale jego preferowany Wariant B nie działa (zweryfikowane w źródle
NestJS). Wariant A jest jedynym z dwóch proponowanych, który faktycznie naprawia
bug. Bug #2 to osobny, równie istotny defekt symetrii CQRS↔events.

Bug #3 (dual-package hazard / token identity) dodany 2026-06-01, zweryfikowany w
kodzie: tokeny to `abstract class` (`packages/cqrs/src/abstracts/`), pakiety
dual-ESM/CJS, `@Optional` injection w `vytches-explorer.service.ts:86` + guard
`:371` dają cichy skip query handlerów. Objaw `queryBus===undefined` ma dwa
źródła (hazard vs. missing-provider Bug #2) — stąd wymóg testu diagnostycznego
przed wyborem fixu. Mitygacja konsumenta `deps.inline` jest TEST-only; trwały
fix biblioteki to tokeny `Symbol.for`.

---

_Task managed by Project Orchestrator | Last AI Review: 2026-06-01_
