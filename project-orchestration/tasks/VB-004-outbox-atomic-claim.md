# Task: Outbox — atomowy claim wiadomości + wycieki timerów

## Task Metadata

```yaml
task_id: VB-004
title: Outbox double-dispatch race (atomic claim contract) + happy-path timer leaks
type: bug
priority: high
complexity: medium
estimated_time: 6h
created_by: LIB-AUDIT-2026-07-02
created_at: 2026-07-02
status: backlog
release_target: pre-first-public-publish
package: '@vytches/ddd-messaging', '@vytches/ddd-resilience'
findings: [F-H2, F-H3]
```

## Dlaczego

**F-H2 — wyścig podwójnego dispatchu (at-least-once staje się
at-least-twice):** `outbox-repository.interface.ts:34-38`
(`getUnprocessedMessages`) nie dokumentuje kontraktu atomowego przejęcia
(brak wymogu semantyki `SELECT ... FOR UPDATE SKIP LOCKED` / CAS), a status
na `PROCESSING` zmienia się dopiero wewnątrz `processMessage`
(`outbox-processor.ts:295-350`). Drugi worker może pobrać te same wiersze
PENDING zanim pierwszy zdąży je oznaczyć → duplikaty dispatchu przy
deploymencie multi-worker. Docstring `scheduleRetry` (95-99) ostrzega
o wyścigu — `getUnprocessedMessages` nie, więc implementujący go przeoczą.

**F-H3 — wycieki timerów na happy-path:** `outbox-processor.ts:376-386`
ściga `handler.handle(msg)` z `setTimeout`-rejection przez `Promise.race`,
ale nigdy nie robi `clearTimeout` gdy handler wygra — każda poprawnie
przetworzona wiadomość zostawia żywy timer na pełne `messageTimeout`
(default 30s). Ten sam wzorzec w `resilience/core/resilience-context.ts:57-63`
(używany przez `CircuitBreaker.execute`). Poprawny wzorzec z `.finally()`
już istnieje w tym samym pakiecie: `bulkhead.ts:91-93`.

## Acceptance Criteria

1. [ ] Kontrakt atomowego claimu udokumentowany w JSDoc
       `getUnprocessedMessages` (wymóg atomic claim / SKIP LOCKED / CAS na
       statusie) LUB nowe API `claimBatch()` z semantyką przejęcia; procesor
       flipuje status przed dispatchem.
2. [ ] Test symulujący dwa współbieżne procesory na tym samym repo —
       zero podwójnych dispatchy.
3. [ ] `clearTimeout` po rozstrzygnięciu race w outbox-processor (wzorzec
       `.finally()` z bulkhead.ts).
4. [ ] To samo w `resilience-context.ts:57-63`.
5. [ ] Backward-compat: interfejs `IOutboxRepository` rozszerzony
       niełamiąco (opcjonalna metoda lub doprecyzowany kontrakt istniejącej).

## Out of scope

- Framework sag (decyzja właściciela: nie ruszamy).
- Wydajność fan-outu outboxa (osobne, jeśli kiedyś potrzebne).

## References

- Analysis: `project-orchestration/analysis/LIB-AUDIT-2026-07-02.analysis.md`
  (F-H2, F-H3)
