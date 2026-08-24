# Task: Hardening warstwy zdarzeń i projekcji

## Task Metadata

```yaml
task_id: VF-025
title: UnifiedEventBus hardening, BaseEventBus DI stub, projections retry/checkpoints, resilience metrics
type: bug
priority: normal
complexity: complex
estimated_time: 11h
created_by: LIB-AUDIT-2026-07-02
created_at: 2026-07-02
status: done
completed_at: 2026-08-24
release_target: post-first-publish OK (ale przed 1.0)
package: '@vytches/ddd-events', '@vytches/ddd-projections', '@vytches/ddd-resilience', '@vytches/ddd-cqrs'
findings: [F-H7, F-H9, F-H10, F-H11, F-M1, F-M3, F-M4, F-M6, F-M9, F-M13, F-M16, SA-M5, SA-M6]
```

## Scope note (2026-08-23, po /analyze + approval)

Zatwierdzona analiza (`project-orchestration/analysis/VF-025.analysis.md`, Q1,
jednomyślne potwierdzenie 4 agentów doradczych) zawęziła zakres TEGO wydania
(PATCH) do czterech bezpiecznych, izolowanych jednostek:

- **A** — AC1 dedup handlerów (warn, nie twardy dedup — D3) + naprawa
  `getHandlers()`; AC4's diagnostyka w `catch` (SA-M5), BEZ flipu
  `autoRegisterHandlers` opt-out→opt-in (to → VF-025b).
- **C** — AC8 (deleteAll→delete, D2) + reset checkpointów przy clear; AC9's
  część RESUME (`loadCheckpoint` wpięte, opt-in, walidacja — Q4), BEZ AC9's
  error-propagation części ani AC7 retryConfig (to → VF-025c).
- **E** — AC10's BONUS wyłącznie: reset `failureCount` przy OPEN→HALF_OPEN RAZEM
  z regułą "porażka w HALF_OPEN zawsze tripuje" jako jedna niepodzielna
  jednostka (Q2), BEZ metrics wire-up (to → VF-025d).
- **G** — AC11's typing: nowa `registerTyped<T extends ICommand>()` obok
  istniejącej `register()` (Q6), BEZ zawężania istniejącej sygnatury; warn przy
  silent overwrite handlera.

Wydzielone follow-up taski: `VF-025b` (flip autoRegisterHandlers), `VF-025c`
(AC7 retryConfig + AC9 error-propagation), `VF-025d` (AC10 metrics wire-up +
AC13 singleton hardening). AC12 (opcjonalny split query/command bus), AC14
(eventName/minifikacja — dokumentacja) pozostają nieprzypisane, poza zakresem
tego wydania.

## Zamknięcie (2026-08-24)

Zakres A+C+E+G wysłany, zweryfikowany (`library-quality-verifier`: GO, 313/313
testów zielone w 4 dotkniętych pakietach), zmergowany do `develop`
(fast-forward, commit `4801b799`). Changeset:
`.changeset/vf-025-event-projections-hardening.md`.

**UWAGA dla kogokolwiek wraca do tego obszaru**: `VF-025b`/`VF-025c`/`VF-025d`
to WYŁĄCZNIE nazwy zarezerwowane w tej notatce i w
`project-orchestration/analysis/VF-025.analysis.md` — pliki tasków dla nich NIE
zostały utworzone (usunięte na wyraźną prośbę właściciela w trakcie tego samego
przebiegu). Zakres B/D/F (patrz wyżej) i AC7/AC9-error-propagation/
AC10-metrics/AC12/AC13/AC14 NIE mają dziś żadnego task file — trzeba je
odtworzyć z tej analizy przed podjęciem tej pracy, inaczej zaginą po cichu z
backlogu.

## Dlaczego

Audyt rozstrzygnął, że **UnifiedEventBus jest kanonicznym busem**
(HOW-TO-event-bus.md, JSDoc @public @stable, default w UniversalEventDispatcher,
LOCAL_EVENT_BUS w module NestJS) — a to właśnie on nie ma zabezpieczeń, które ma
jego klasa bazowa. Do tego warstwa projekcji ma strukturalnie kompletne, ale
częściowo niepodłączone mechanizmy (retry-config, checkpointy), a resilience
wystawia niedziałające API metryk.

## Zakres / Acceptance Criteria

### UnifiedEventBus (F-M3, F-H11)

1. [x] Egzekwowanie `MAX_HANDLERS_PER_EVENT` w `registerHandlerWithContext`
       (unified-event-bus.ts:381-389); dedup subskrypcji (Set/identity).
   > NOTE 2026-07-10: cap enforcement DONE w VF-029 (assertHandlerCapacity w
   > registerHandlerWithContext + static przez this.constructor); w tym tasku
   > zostaje tylko dedup subskrypcji. AC2 (identity unsubscribe) i agregacja
   > błędów z AC3 również zrealizowane w VF-029 (AggregatedEventHandlerError +
   > sprzątanie pustych kluczy). DONE 2026-08-24 (jednostka A): dedup jako
   > WARN-only (D3 z analizy) — duplikat handler+contexts loguje ostrzeżenie,
   > nadal się rejestruje.
2. [x] ~~Unsubscribe po tożsamości~~ — DONE w VF-029
       (`classHandlerWrappers: Map<object, Map<string, wrapper>>`,
       unified-event-bus.ts:112-119).
3. [x] ~~Błędy fan-outu agregowane~~ — DONE w VF-029
       (`AggregatedEventHandlerError`, publiczny eksport; puste klucze Map
       sprzątane przy unsubscribe).
4. [ ] Auto-rejestracja z `globalThis.VytchesDDD` w konstruktorze
       (unified-event-bus.ts:130-149) — **częściowo zamknięte**: VF-029 usunęło
       zaślepkę DI w `BaseEventBus` (AC6 poniżej). 2026-08-24 (jednostka A):
       goły `catch` dostał diagnostykę (SA-M5, `internalLogger.warn`). WCIĄŻ
       OTWARTE: flip opt-out→opt-in — wymaga deprecation window, brak task file
       (nazwa zarezerwowana `VF-025b`, patrz "Zamknięcie" wyżej).
5. [ ] Udokumentowana semantyka `publishMany` (brak gwarancji kolejności między
       zdarzeniami) i różnice vs BaseEventBus.
   > NOTE 2026-07-10: częściowo zrobione w VF-029 —
   > `publishMany(events, { sequential? })` dodane z JSDoc ostrzeżeniem, że
   > domyślny `Promise.all` nie gwarantuje kolejności. Zostaje: LLMGUIDE
   > events/projections nadal nie odsyła do tej sekcji JSDoc — dopisać link.

### BaseEventBus (F-H9)

6. [x] ~~Zaślepka DI `resolve: () => null`~~ — DONE w VF-029: cała maszyneria
       `useDI`/`VytchesDDD` stub/`discoverHandlers()`/`registerHandlerFactory`
       usunięta z `BaseEventBus` (zero realnych konsumentów, BREAKING CHANGE
       pre-publish). AC4 powyżej to OSOBNA ścieżka (auto-rejestracja
       `UnifiedEventBus`) — nie jest tym samym kodem i nie została ruszona.

### Projekcje (F-H10, F-M4)

7. [ ] `shouldRetry` dostaje `this.retryConfig` (projection-engine.ts:309) —
       retryableErrors/nonRetryableErrors/maxAttempts konsumenta działają.
       OTWARTE, poza zakresem tego wydania — brak task file (nazwa zarezerwowana
       `VF-025c`, patrz "Zamknięcie" wyżej).
8. [x] `clearProjectionState`: per-projection delete zamiast `deleteAll()`
       (interfejs `projection-interfaces.ts:24` — rozszerzenie niełamiące);
       reset checkpointów przy clear (obecnie TODO,
       projection-rebuilder.ts:282-284). DONE 2026-08-24 (jednostka C).
9. [x] `loadCheckpoint` wpięte w rebuilder (resume) LUB udokumentowany wymóg
       idempotentnego `apply` do czasu wdrożenia; ProjectionProcessor przestaje
       połykać błędy (konfigurowalna strategia). DONE 2026-08-24 (jednostka C) —
       WYŁĄCZNIE część resume, opt-in `resumeFromCheckpoint`, default false, z
       pełną walidacją. Część "ProjectionProcessor przestaje połykać błędy" NIE
       zrobiona — brak task file (nazwa zarezerwowana `VF-025c`).

### Resilience (F-H7)

10. [ ] `enableMetrics`/`getResilienceMetrics()`/klasy `*MetricCollector`:
        podłączone do circuit-breaker/retry/bulkhead ALBO usunięte z publicznego
        API (dziś: udokumentowana funkcja, która nie działa). Bonus: reset
        failureCount przy OPEN→HALF_OPEN (spójność metryk). Bonus DONE
        2026-08-24 (jednostka E) — reset failureCount RAZEM z regułą "porażka w
        HALF_OPEN zawsze tripuje", jedna niepodzielna zmiana. Główna część
        (metrics wire-up) OTWARTA — brak task file (nazwa zarezerwowana
        `VF-025d`).

### CQRS (F-M1, F-M9 — opcjonalnie w tym tasku lub follow-up)

11. [x] `register()`/`registerFactory()` typowane względem command/query (koniec
        `commandType: unknown`); warn przy silent overwrite handlera. DONE
        2026-08-24 (jednostka G) — zreinterpretowane wg analizy (Q6):
        `commandType: unknown` NIE zawężone (żywa ścieżka string-key), zamiast
        tego nowa `registerTyped()`/`registerFactoryTyped()` obok. Warn przy
        overwrite zrobiony.
12. [ ] (Opcjonalnie) split enhanced-query-bus.ts (946 linii) /
        enhanced-command-bus.ts (742) — ekstrakcja cache/TTL z dispatchu.
        Nieprzypisane, poza zakresem tego wydania, brak task file.

### Przekrojowe

13. [ ] Singletony (`globalPolicyEventBus`, `GlobalMetricRegistry`,
        `GlobalObservabilityEventBus`) kluczowane na `globalThis`/`Symbol.for` —
        ochrona przed dual ESM/CJS load (F-M6). `globalPolicyEventBus` VOID
        (usunięty w VF-024). Reszta OTWARTA — brak task file (nazwa
        zarezerwowana `VF-025d`).
14. [ ] Decyzja/dokumentacja: `eventName` z `constructor.name` a minifikacja
        (F-M13); upcasting bez jawnego `targetVersion` (F-M16). Nieprzypisane,
        poza zakresem tego wydania, brak task file.

## Out of scope

- Saga (nie ruszamy — decyzja właściciela).
- forFeature/moduł NestJS — VB-003.

## References

- Analysis: `project-orchestration/analysis/LIB-AUDIT-2026-07-02.analysis.md`
  (F-H7, F-H9, F-H10, F-H11, F-M1, F-M3, F-M4, F-M6 + Załączniki G, J)
- Analysis: `project-orchestration/analysis/SEC-AUDIT-2026-07-09.analysis.md` —
  niezależnie potwierdza AC3 (SA-M6: `executeHandlers` rzuca tylko `errors[0]`,
  unified-event-bus.ts:438-465) i AC4 (SA-M5: goły catch bez diagnostyki w
  `autoRegisterHandlers`, :120-143). Zakres bez zmian.
