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
status: done
release_target: pre-first-public-publish
package: '@vytches/ddd-messaging', '@vytches/ddd-resilience'
findings: [F-H2, F-H3]
completed_at: 2026-07-03
```

## Completion Note (2026-07-03)

Implemented via `/analyze-ddd` (approved analysis:
`project-orchestration/analysis/VB-004-outbox-atomic-claim.analysis.md`,
decisions D-1..D-6, units U-1/U-2, all 5 open questions answered — OQ-1 resolved
as a single run with two phase-separated units rather than a split into separate
task invocations) and one `/orchestrate-ddd` run (single Workflow script, two
units in one pass, per OQ-1's answer):

- **U-1 (`@vytches/ddd-messaging`, AC#1/#2/#3/#5)**: GO on first attempt.
  Optional `claimBatch?()` added to `IOutboxRepository` (non-atomic default,
  documented single-worker-only), gated behind opt-in
  `OutboxProcessorOptions.useClaimBatch`; `try/finally clearTimeout` fix for the
  message-handler race; RED/GREEN concurrency test pair proving the processor
  honors an atomic-claim contract (RED control demonstrably double-dispatches,
  GREEN does not). Verified: `@vytches/ddd-messaging` 96/96 tests green,
  typecheck/lint clean, and — per OQ-5's action item — `@vytches/ddd-testing`
  138/138 tests green including all 29 `InMemoryOutboxRepository` tests with
  zero source changes needed there (empirically confirms the `?`-optional design
  choice was necessary, not just theoretically safe).
- **U-2 (`@vytches/ddd-resilience`, AC#4/#5)**: GO on first attempt. Optional
  `dispose?(): void` added to the `ResilienceContext` interface; fixes both the
  original timer leak AND a second leak the analysis panel discovered mid-review
  (a parent-signal `abort` listener never removed on the happy path, in scope
  per OQ-2) in `fork()`; wired into `CircuitBreaker.execute` and
  `TimeoutStrategy.execute` (the latter restructured from `.then/.catch` to
  cover both paths). New greenfield test suite
  `packages/resilience/tests/core/resilience-context.test.ts`
  (`vi.getTimerCount()` for timer clearance + a separate listener-removal
  assertion, a new idiom for this repo per decision D-5).
- **Final gate** (`library-quality-verifier`): GO. First attempt at this gate
  failed with a tooling error (`agent({schema})`: subagent completed without
  calling `StructuredOutput` — scope of the check was too large for one turn
  budget); recovered without a full re-run by trimming the gate's prompt and
  resuming via `resumeFromRunId` (8 of 9 already-passed agent calls replayed
  from cache).
- **OQ-4** (stretch goal — prove `claimBatch`'s PROCESSING marks are visible to
  `resetStaleProcessing()`): explicitly skipped, with reasoning recorded in the
  implementer's own report (would require building a third, more elaborate test
  fixture; task explicitly allowed skipping it if it risked the core ACs). No AC
  depends on it.
- **OQ-3 follow-up**:
  `project-orchestration/tasks/VF-027-resilience-context-abortsignal-rewrite.md`
  already created (backlog) for the native `AbortSignal.any()`/
  `AbortSignal.timeout()` rewrite that D-4's fix is an interim stand-in for.

Pre-commit hooks ran normally (`--no-verify` is hard-blocked by this repo's own
tooling, confirmed twice this session) — see git log for the commit hash.

## Dlaczego

**F-H2 — wyścig podwójnego dispatchu (at-least-once staje się at-least-twice):**
`outbox-repository.interface.ts:34-38` (`getUnprocessedMessages`) nie
dokumentuje kontraktu atomowego przejęcia (brak wymogu semantyki
`SELECT ... FOR UPDATE SKIP LOCKED` / CAS), a status na `PROCESSING` zmienia się
dopiero wewnątrz `processMessage` (`outbox-processor.ts:295-350`). Drugi worker
może pobrać te same wiersze PENDING zanim pierwszy zdąży je oznaczyć → duplikaty
dispatchu przy deploymencie multi-worker. Docstring `scheduleRetry` (95-99)
ostrzega o wyścigu — `getUnprocessedMessages` nie, więc implementujący go
przeoczą.

**F-H3 — wycieki timerów na happy-path:** `outbox-processor.ts:376-386` ściga
`handler.handle(msg)` z `setTimeout`-rejection przez `Promise.race`, ale nigdy
nie robi `clearTimeout` gdy handler wygra — każda poprawnie przetworzona
wiadomość zostawia żywy timer na pełne `messageTimeout` (default 30s). Ten sam
wzorzec w `resilience/core/resilience-context.ts:57-63` (używany przez
`CircuitBreaker.execute`). Poprawny wzorzec z `.finally()` już istnieje w tym
samym pakiecie: `bulkhead.ts:91-93`.

## Acceptance Criteria

1. [x] Kontrakt atomowego claimu — nowe opcjonalne `claimBatch?()` na
       `IOutboxRepository` (D-2); `getUnprocessedMessages` pozostaje bez zmian,
       procesor flipuje status przed dispatchem gdy `useClaimBatch: true`.
2. [x] Test symulujący dwa współbieżne procesory — para RED (double-dispatch
       potwierdzony) / GREEN (zero duplikatów) w `outbox-processor.test.ts`
       (D-3).
3. [x] `clearTimeout` po rozstrzygnięciu race w outbox-processor — `try/finally`
       (D-1), zweryfikowane testem `vi.getTimerCount()`.
4. [x] To samo w `resilience-context.ts` — plus drugi, odkryty w trakcie analizy
       wyciek (listener na sygnale rodzica), oba naprawione przez opcjonalne
       `dispose?()` (D-4).
5. [x] Backward-compat: `claimBatch?()` i `dispose?()` — oba opcjonalne,
       empirycznie potwierdzone konieczne (realny konsument
       `InMemoryOutboxRepository` w `@vytches/ddd-testing` przestałby się
       kompilować, gdyby `claimBatch` był wymagany).

## Out of scope

- Framework sag (decyzja właściciela: nie ruszamy).
- Wydajność fan-outu outboxa (osobne, jeśli kiedyś potrzebne).

## References

- Analysis: `project-orchestration/analysis/LIB-AUDIT-2026-07-02.analysis.md`
  (F-H2, F-H3)
