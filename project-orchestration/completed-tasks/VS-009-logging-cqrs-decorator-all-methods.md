# Task: CQRS class decorator — owija wszystkie metody zamiast tylko `handle`

## Task Metadata

```yaml
task_id: VS-009
title:
  'logging: @LogCommands class decorator — wrap only handle() method, not all
  prototype methods'
type: bug
priority: high
complexity: moderate
estimated_time: 2.5h
created_by: agent (multi-agent analysis 2026-05-27)
created_at: 2026-05-27
status: cancelled
cancelled_reason: >
  Decyzja architektoniczna (2026-05-29): warstwa logowania APLIKACYJNEGO
  (dekoratory @LogCommands/@LogQueries/@LogCQRS, aggregate hooks, middleware)
  jest zbędna — biblioteka NIE jest od logowania aplikacji. Zostaje tylko port
  `Logger` (interfejs) + minimalna diagnostyka wewnętrzna. VS-009 polerował
  feature przeznaczony do usunięcia. Patrz nowy task: usunięcie Roli B. Memory:
  [[feedback_logging_internal_only]].
security_finding: SEC-LOGGING-005
dread_score: 8
audit_ref: docs/security/threat-models/TM-VS-001.md
```

---

## ⚠️ Korekta zakresu (2026-05-29, analiza 5 agentów)

**BLOKER spec↔kod (zweryfikowany):** zadanie zakłada default `['handle']`, ale
biblioteka ma **dwa kanoniczne kontrakty handlerów** — i dekoratory klas z
VS-009 są jedynym narzędziem do logowania obu:

- **Command/Query** → `execute()`:
  `packages/cqrs/src/interfaces/handler.interface.ts:4-10`
  (`ICommandHandler`/`IQueryHandler`). Bus woła `handler.execute(...)`
  (command-bus.ts:149, query-bus.ts:135). Wszystkie 9 handlerów w
  `cqrs-decorators.test.ts:28-201` używa `execute`.
- **Event handler (domenowy/integracyjny)** → `handle()`:
  `packages/contracts/src/events/event-handler-interface.ts:23`
  (`IEventHandler`, sygnatura `Promise<void> | void`). Konsument loguje event
  handlery przez `@LogCQRS`/`@LogCommands` (brak dedykowanego class-decoratora
  dla eventów — `LogDomainEvents`/`LogStateChanges` to MethodDecoratory dla
  **agregatów**).

**Decyzja: default `methodsToWrap = ['execute', 'handle']`** (nie `['handle']`).
Pokrywa OBA kontrakty; `['handle']` zepsułoby CQRS, a `['execute']` zepsułoby
event handlery konsumenta. Default jest **backward-compatible** (dziś owijane
jest wszystko, więc i `execute`, i `handle`). **Bezpieczeństwo zachowane:**
guardy (`canHandle`/`authorize`/`isAllowed` → `boolean`) pozostają poza listą,
więc koercja sync→async ich nie dotyka; sync `handle` zwracające `void` jest
bezpieczne (event bus awaita/ignoruje). Metody pomocnicze
(`validate`/`toEvent`/`enrich`) przestają być owijane — cel VS-009.

**Dodatkowe ustalenia agentów:**

- **Refaktor (library-expert):** trzy identyczne pętle (LogCommands/LogQueries/
  LogCQRS) → wspólna `applyLoggingDecorator(target, operationType, options)`.
- **Warning bez throw:** użyć
  `DefaultLogger.forContext('CQRSDecorator').warn(...)` — statyczne, nie wymaga
  instancji (dekoracja dzieje się przed `new`).
- **Dziedziczenie:** `proto[name]` widzi łańcuch prototypów → `execute` z klasy
  bazowej **zostanie** owinięte (zachowanie poprawne i pożądane).
- **Strażniki N1:** `name === 'constructor'` + `typeof fn === 'function'`
  wystarczą (`__proto__` odpada automatycznie — typeof `object`).
- **Code smell (compliance-guardian, follow-up):** `getOrCreateLogger`
  (cqrs-decorators.ts:154-159) mutuje `instance._logger` na obiekcie konsumenta
  — osobny task, rozważyć `WeakMap`. NIE w scope VS-009.
- **Performance (performance-optimizer):** zysk runtime ≈ 0 (metody pomocnicze
  nie są hot path). Jedyny realny zysk: `maskSensitiveData:true` na klasie
  wielometodowej tworzy N× `DataMasker` zamiast 1×. Uzasadnienie =
  bezpieczeństwo.

### Rozszerzenie scope (2026-05-29): naprawa mutacji `instance._logger` (Phase 3)

Pierwotny follow-up (`getOrCreateLogger` mutuje obiekt konsumenta) **włączony do
VS-009** — to ten sam plik i ta sama warstwa. Ustalenia decydujące o włączeniu:

- Wzorzec występuje w **dwóch** plikach: `cqrs-decorators.ts:154-159` ORAZ
  `aggregate-hooks.ts:12,106-110` (identyczna mutacja `instance._logger`).
- `_logger` **nie jest publicznym API**: interfejs `AggregateInstance` nie jest
  eksportowany (`integration/index.ts` eksportuje tylko
  `StateChangeLoggingOptions`), a w `cqrs-decorators` pole żyje na nietypowanym
  `Record`. Żaden test nie używa `_logger`. → zamiana na `WeakMap` jest
  **non-breaking**.
- Fix musi objąć **oba** pliki przez wspólny util (inaczej połowiczny smell).
  Wykonać jako **osobny commit** (`refactor`), odrębny od bugfixa wrappingu.

---

## Domain Context

```yaml
bounded_context: Logging / CQRS Integration
patterns:
  - Decorator
  - Command Handler
```

## Business Context

### Why This Task Exists

Multi-agentowa analiza techniczna (2026-05-27) wykryła, że dekoratory
`@LogCommands`, `@LogQueries`, `@LogCQRS` owijają **wszystkie** metody klasy,
nie tylko `handle`.

Aktualnie (cqrs-decorators.ts linia 13-28):

```typescript
const originalMethods = Object.getOwnPropertyNames(target.prototype);
for (const methodName of originalMethods) {
  if (methodName === 'constructor') continue; // tylko constructor jest pomijany
  // WSZYSTKIE inne metody są owijane — w tym gettery, metody pomocnicze, prywatne
  target.prototype[methodName] = createLoggingWrapper(...);
}
```

Konsekwencje:

- Przypadkowe logowanie wewnętrznych metod handlera (np. `validate()`,
  `toEvent()`)
- Potencjalne wyciekanie PII przez metody pomocnicze
- Performance overhead — każda metoda instanceu jest owinięta w async wrapper
- Naruszenie zasady minimalnego zaskoczenia: `@LogCommands` powinien logować
  komendy, nie wszystko

### Expected Business Value

- [ ] Dekorator loguje tylko metodę `handle` (zgodnie z Command Handler pattern)
- [ ] Metody pomocnicze klasy nie są owijane w logging wrapper
- [ ] Opcja konfiguracyjna `methodsToWrap?: string[]` dla specjalnych przypadków

### Success Metrics

- Klasa z metodami `handle`, `validate`, `toEvent` — tylko `handle` jest
  logowane
- Backward-compatible: jeśli klasa ma tylko `handle`, zachowanie niezmienione

## Technical Context

### Current State

```typescript
// cqrs-decorators.ts:13-28 — wszystkie metody prototype
const originalMethods = Object.getOwnPropertyNames(target.prototype);
for (const methodName of originalMethods) {
  if (methodName === 'constructor') continue;
  // ... owijanie wszystkich metod
}
```

### Desired State

```typescript
// Podejście 1: execute (CQRS) + handle (event handlery) — oba kontrakty biblioteki
const methodsToWrap = options.methodsToWrap ?? ['execute', 'handle'];

for (const methodName of methodsToWrap) {
  const originalMethod = target.prototype[methodName];
  if (typeof originalMethod !== 'function') continue;
  target.prototype[methodName] = createLoggingWrapper(
    originalMethod,
    methodName,
    operationType,
    options,
    masker
  );
}

// Podejście 2: addytywny whitelist
// Konsument może dodać inne metody przez options.methodsToWrap: ['handle', 'execute']
```

### Technical Constraints

- Domyślny `methodsToWrap: ['handle']` jest **breaking** dla klas, które mają
  inne metody i polegają na ich loggowaniu — ale to był niezamierzony behavior,
  więc traktujemy jako bugfix
- Jeśli klasa nie ma metody `handle` (edge case), dekorator nie owija niczego —
  logować warning

## Requirements & Acceptance Criteria

### Functional Requirements

- [ ] Domyślnie owijana tylko metoda `handle`
- [ ] `options.methodsToWrap?: string[]` pozwala zmienić listę metod
- [ ] Jeśli żadna z metod z `methodsToWrap` nie istnieje — log warning i
      kontynuuj
- [ ] Backward-compat: handlery z jedną metodą `handle` — zachowanie
      niezmienione

### Non-Functional Requirements

- [ ] Testy: klasa z `handle` + `validate` — tylko `handle` jest zalogowane
- [ ] Testy: `methodsToWrap: ['handle', 'execute']` — obie metody logowane
- [ ] JSDoc: zaktualizować `CQRSLoggingOptions` o `methodsToWrap`

### Definition of Done

- [ ] `cqrs-decorators.ts` używa `methodsToWrap ?? ['execute', 'handle']`
      zamiast wszystkich metod prototype
- [ ] Trzy dekoratory zrefaktorowane do wspólnej `applyLoggingDecorator(...)`
- [ ] Warning bez throw przez `DefaultLogger.forContext('CQRSDecorator')` gdy
      brak metody
- [ ] (Phase 3) `cqrs-decorators.ts` i `aggregate-hooks.ts` bez mutacji
      `instance._logger` (WeakMap)
- [ ] Testy zielone (w tym zaktualizowane testy VS-001)
- [ ] SEC-LOGGING-005 oznaczony jako resolved
- [ ] Changelog: nota o zawężeniu zakresu logowania (bugfix) + refaktor loggera

## Agent Assignments

```yaml
lead_agent: library-expert
supporting_agents:
  - agent: library-quality-verifier
    role: verify no unintended behavior change for common handler patterns
    deliverables: PASS/VETO verdict
```

## Implementation Plan

### Phase 1: Zmiana logiki wrappowania

- **Agent**: library-expert
- **Tasks**:
  - [ ] Dodaj `methodsToWrap?: string[]` do `CQRSLoggingOptions` (default:
        `['handle']`)
  - [ ] Zmień pętle w `LogCommands`, `LogQueries`, `LogCQRS` — iteruj po
        `methodsToWrap`
  - [ ] Dodaj warning gdy żadna metoda z listy nie istnieje na prototype
- **Output**: zmodyfikowany `cqrs-decorators.ts`

### Phase 2: Testy

- **Agent**: library-expert
- **Tasks**:
  - [ ] Test: command handler z `execute` + `validate` — tylko `execute`
        logowane
  - [ ] Test: event handler z `handle` (IEventHandler) — `handle` logowane
        (domyślnie)
  - [ ] Test: `validate()`/`canHandle()` zwraca synchroniczną wartość (nie
        `Promise`) — brak koercji
  - [ ] Test: `methodsToWrap: ['execute', 'custom']` — override domyślnej listy
  - [ ] Test: klasa bez `execute` i bez `handle` — warning bez throw
  - [ ] Test: dziedziczone `execute`/`handle` z klasy bazowej — owijane
  - [ ] Regresja: istniejące testy VS-001 (`execute`) zielone bez zmian
        fixture'ów

### Phase 3: Refaktor mutacji loggera → WeakMap (osobny commit)

- **Agent**: library-expert
- **Tasks**:
  - [ ] Wspólny util `getOrCreateLogger(instance, contextName?)` z module-scoped
        `WeakMap<object, Logger>` (zamiast `instance._logger`)
  - [ ] Podpiąć w `cqrs-decorators.ts` ORAZ `aggregate-hooks.ts`
  - [ ] Usunąć `_logger?: Logger` z niepublicznego interfejsu
        `AggregateInstance`
  - [ ] Test: ten sam logger reużywany dla wielu wywołań tej samej instancji
  - [ ] Test: brak doklejonego pola `_logger` na obiekcie konsumenta po
        wywołaniu
- **Output**: `cqrs-decorators.ts`, `aggregate-hooks.ts` bez mutacji instancji

## Progress Tracking

### Current Status

```yaml
overall_progress: 0%
current_phase: planned
blockers: []
last_updated: 2026-05-27
```

### Activity Log

| Date       | Agent         | Action                                 | Result          |
| ---------- | ------------- | -------------------------------------- | --------------- |
| 2026-05-27 | multi-agent   | Finding detected (DDD Patterns Expert) | SEC-LOGGING-005 |
| 2026-05-27 | product-owner | Task created, P1 priority              | VS-009 planned  |

## Code References

### Files to Modify

```yaml
packages:
  - package: '@vytches/ddd-logging'
    files:
      - src/integration/cqrs-decorators.ts # Phase 1-2 (wrapping) + Phase 3 (WeakMap)
      - src/integration/aggregate-hooks.ts # Phase 3: ta sama mutacja _logger
      - tests/integration/cqrs-decorators.test.ts
      - tests/integration/aggregate-hooks.test.ts # Phase 3 regresja (jeśli istnieje)
```

## Risk Assessment

### Technical Risks

| Risk                                      | Probability | Impact | Mitigation                            |
| ----------------------------------------- | ----------- | ------ | ------------------------------------- |
| Konsument loguje przez niehandlowe metody | Very Low    | Low    | Niezamierzony behavior — bugfix scope |
| Handler bez `handle` metody               | Low         | Low    | Warning + graceful skip               |

## Security Considerations

> Threat model:
> [`docs/security/threat-models/TM-VS-009.md`](../../docs/security/threat-models/TM-VS-009.md)
> | Method: STRIDE + DREAD + LINDDUN | Date: 2026-05-29 | Verdict: **PROCEED
> (HIGH)**

VS-009 to zmiana **redukująca ryzyko** — zawęża powierzchnię ataku obecnego
defektu (SEC-LOGGING-005). Threat model zidentyfikował, że pełen zakres defektu
jest **wyższy** niż framing „nadmiarowe logowanie" (`dread_score: 8`):

| Zagrożenie zamykane przez VS-009                                                  | DREAD  | Priorytet |
| --------------------------------------------------------------------------------- | ------ | --------- |
| T1/E1 — koercja sync→async owiniętego guarda → cichy bypass walidacji/autoryzacji | **11** | HIGH      |
| I1 — nadmiarowa ekspozycja PII przez payloady metod pomocniczych                  | **11** | HIGH      |
| D1 — narzut owijania wszystkich metod                                             | 6      | LOW       |

**Kluczowe ustalenie:** `createLoggingWrapper` zwraca `async function`, więc
owinięcie metody **synchronicznej** (`validate`/`canHandle`/getter) zamienia jej
zwracaną wartość w `Promise` (zawsze truthy) → konsument w
`if (this.canHandle(cmd))` przechodzi warunek bezwarunkowo. Owijanie tylko
`handle` (już async) usuwa ten wektor w całości.

**Wymogi bezpieczeństwa dla implementacji (z TM):**

- Defensywnie weryfikować `typeof prototype[name] === 'function'` dla każdej
  nazwy z `methodsToWrap` + utrzymać pominięcie `constructor` (neutralizuje N1).
- JSDoc na `methodsToWrap`: ostrzec, że dodanie metody synchronicznej ją
  „asyncuje" (rezydualne ryzyko LOW, opcjonalny follow-up: ostrzeżenie o
  nie-async metodzie).
- Changelog: zawężenie zakresu logowania to świadomy bugfix (zmiana zachowania,
  ale backward-compatible na poziomie API).

`methodsToWrap` to config czasu dekoracji (developer), **nie** runtime input —
poprawka nie wprowadza nowych zagrożeń HIGH/MEDIUM.

## Testing Strategy

### Unit Tests

- [ ] Klasa z `handle()` + `validate()` — `validate` nie jest owinięty
- [ ] `methodsToWrap: ['handle', 'execute']` — oba owinięte
- [ ] Klasa bez `handle` — warning bez throw, brak wrappowania
- [ ] Istniejące testy z `handle` — zachowanie niezmienione

## Links & References

### Related Tasks

- VS-001: CQRS masking (ten sam plik `cqrs-decorators.ts`)
- VS-002: ConsoleProvider masking

### External Resources

- `docs/security/threat-models/TM-VS-001.md` — SEC-LOGGING-005

---

_Task managed by Project Orchestrator | Multi-Agent Analysis: 2026-05-27_
