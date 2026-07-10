# Task: Hardening warstwy zdarzeń i projekcji

## Task Metadata

```yaml
task_id: VF-025
title: UnifiedEventBus hardening, BaseEventBus DI stub, projections retry/checkpoints, resilience metrics
type: bug
priority: normal
complexity: complex
estimated_time: 14h
created_by: LIB-AUDIT-2026-07-02
created_at: 2026-07-02
status: backlog
release_target: post-first-publish OK (ale przed 1.0)
package: '@vytches/ddd-events', '@vytches/ddd-projections', '@vytches/ddd-resilience', '@vytches/ddd-cqrs'
findings: [F-H7, F-H9, F-H10, F-H11, F-M1, F-M3, F-M4, F-M6, F-M9, F-M13, F-M16, SA-M5, SA-M6]
```

## Dlaczego

Audyt rozstrzygnął, że **UnifiedEventBus jest kanonicznym busem**
(HOW-TO-event-bus.md, JSDoc @public @stable, default w UniversalEventDispatcher,
LOCAL_EVENT_BUS w module NestJS) — a to właśnie on nie ma zabezpieczeń, które ma
jego klasa bazowa. Do tego warstwa projekcji ma strukturalnie kompletne, ale
częściowo niepodłączone mechanizmy (retry-config, checkpointy), a resilience
wystawia niedziałające API metryk.

## Zakres / Acceptance Criteria

### UnifiedEventBus (F-M3, F-H11)

1. [ ] Egzekwowanie `MAX_HANDLERS_PER_EVENT` w `registerHandlerWithContext`
       (unified-event-bus.ts:381-389); dedup subskrypcji (Set/identity).
   > NOTE 2026-07-10: cap enforcement DONE w VF-029 (assertHandlerCapacity w
   > registerHandlerWithContext + static przez this.constructor); w tym tasku
   > zostaje tylko dedup subskrypcji. AC2 (identity unsubscribe) i agregacja
   > błędów z AC3 również zrealizowane w VF-029 (AggregatedEventHandlerError +
   > sprzątanie pustych kluczy).
2. [ ] Unsubscribe po tożsamości: `Map<originalHandler, wrapper>` zamiast
       matchingu `toString().includes('handler.handle(event)')` (:323-331).
3. [ ] Błędy fan-outu agregowane (`AggregateError` lub `errors` na rzucanym
       błędzie) zamiast gubienia errors[2..n] (:436-462); sprzątanie pustych
       kluczy Map przy unsubscribe.
4. [ ] Auto-rejestracja z `globalThis.VytchesDDD` w konstruktorze (:109-141) —
       za opt-in flagą lub usunięta (cross-context leakage).
5. [ ] Udokumentowana semantyka `publishMany` (brak gwarancji kolejności między
       zdarzeniami) i różnice vs BaseEventBus.

### BaseEventBus (F-H9)

6. [ ] Zaślepka DI `resolve: () => null` (base-event-bus.ts:11-21) — realne DI
       albo default `useDI=false` + null-safe `registerHandlerFactory` (dziś:
       gwarantowany TypeError przy publish).

### Projekcje (F-H10, F-M4)

7. [ ] `shouldRetry` dostaje `this.retryConfig` (projection-engine.ts:309) —
       retryableErrors/nonRetryableErrors/maxAttempts konsumenta działają.
8. [ ] `clearProjectionState`: per-projection delete zamiast `deleteAll()`
       (interfejs `projection-interfaces.ts:24` — rozszerzenie niełamiące);
       reset checkpointów przy clear (obecnie TODO,
       projection-rebuilder.ts:282-284).
9. [ ] `loadCheckpoint` wpięte w rebuilder (resume) LUB udokumentowany wymóg
       idempotentnego `apply` do czasu wdrożenia; ProjectionProcessor przestaje
       połykać błędy (konfigurowalna strategia).

### Resilience (F-H7)

10. [ ] `enableMetrics`/`getResilienceMetrics()`/klasy `*MetricCollector`:
        podłączone do circuit-breaker/retry/bulkhead ALBO usunięte z publicznego
        API (dziś: udokumentowana funkcja, która nie działa). Bonus: reset
        failureCount przy OPEN→HALF_OPEN (spójność metryk).

### CQRS (F-M1, F-M9 — opcjonalnie w tym tasku lub follow-up)

11. [ ] `register()`/`registerFactory()` typowane względem command/query (koniec
        `commandType: unknown`); warn przy silent overwrite handlera.
12. [ ] (Opcjonalnie) split enhanced-query-bus.ts (946 linii) /
        enhanced-command-bus.ts (742) — ekstrakcja cache/TTL z dispatchu.

### Przekrojowe

13. [ ] Singletony (`globalPolicyEventBus`, `GlobalMetricRegistry`,
        `GlobalObservabilityEventBus`) kluczowane na `globalThis`/`Symbol.for` —
        ochrona przed dual ESM/CJS load (F-M6).
14. [ ] Decyzja/dokumentacja: `eventName` z `constructor.name` a minifikacja
        (F-M13); upcasting bez jawnego `targetVersion` (F-M16).

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
