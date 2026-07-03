# Task: NestJS forFeature — naprawa okablowania DI izolacji kontekstów

## Task Metadata

```yaml
task_id: VB-003
title: forFeature() ModulesContainer fix + forRootAsync + module API cleanup
type: bug
priority: critical
complexity: medium
estimated_time: 8h
created_by: LIB-AUDIT-2026-07-02
created_at: 2026-07-02
status: done
release_target: pre-first-public-publish
package: '@vytches/nestjs'
findings: [F-C4, F-H8, F-M5, F-M15, F-M19]
completed_at: 2026-07-03
```

## Completion Note (2026-07-03)

Verified against the working tree (staged, not yet committed/merged):

- `pnpm --filter @vytches/ddd-nestjs test` — 23 test files, 215 tests, all
  passing.
- AC1: `ModulesContainer` confirmed absent from `forFeature` providers
  (`vytches-ddd-feature.module.ts`), with an explanatory comment on why it must
  stay absent.
- AC2: real e2e test added — `tests/feature/feature-di-wiring.e2e.test.ts` (198
  lines, `Test.createTestingModule(...).compile()` + `app.init()`).
- AC3: `forRootAsync()` removed from the public API (decision D-2 in the
  analysis) rather than fixed — confirmed safe: the primary downstream consumer
  has zero call sites for `forRootAsync`/`forRoot`/`forFeature`/
  `forContext`/`forContexts`, per OQ-3 verification in the analysis doc.
- AC4: `configureContext()` now called from both `forContext()` and
  `forContexts()` factories, making `strictHandlerRegistration` reachable (was
  previously a write-only private-field cast).
- AC5: new `BusRegistrationLedger` service
  (`src/services/bus-registration-ledger.ts` + test) deduplicates
  `(eventType, handlerType)` registrations across multiple explorer instances.
- AC6: `AutoDiscoveryService` and its `discovery/` module deleted; no
  `deprecated` fields remain in `types.ts`.
- AC7: no remaining deep import of `@nestjs/core/injector/modules-container.js`
  anywhere in `src/`.
- AC8: regression — all existing nestjs tests green (see test run above).

Note: this is a **behavioral breaking change** despite an unchanged type
signature (F-C4's fix stops the cross-context event leak) — flag as
`BREAKING CHANGE:` in the commit/changelog, not a plain `fix:`, per the analysis
doc's explicit call-out.

---

## 🔒 Security Pre-Analysis

**Granularity:** Feature TM **TM file:**
[`docs/security/threat-models/TM-VB-003-nestjs-forfeature-di-wiring.md`](../../docs/security/threat-models/TM-VB-003-nestjs-forfeature-di-wiring.md)
**Status:** DRAFT — pending Tech Lead sign-off **Date:** 2026-07-02

**Findings summary** (from TM file):

- 1 CRITICAL threat (DREAD ≥ 12) — TM-VB-003-001 (Score 14): cross-context
  information disclosure via `FeatureHandlerRegistrar.findOwnModule()` (F-C4)
- 2 HIGH threats (DREAD 9–11) — TM-VB-003-002 (F-M5, duplicate registration),
  TM-VB-003-003 (F-H8, `forRootAsync` fail-open to `global:true`)
- Mitigations integrated into scope: F-C4 fix (remove `ModulesContainer` from
  providers), e2e test AC #2, duplicate-registration guard (AC #5),
  `forRootAsync` decision (AC #3)
- Story points adjustment: none — mitigations are already covered by the task's
  existing Acceptance Criteria

**PII categories:** none directly in the library — conditional (consumer-defined
domain event payloads, usage-dependent) **Lawful basis (RODO Art. 6):** N/A (DI
library, does not process PII itself) **DPIA required:** NO (library does not
process PII; recommend a retrospective check on the consumer side if production
traffic was exposed to F-C4 — see TM Section 6)

**Audit trail:** no structured "handler misrouted" audit exists — gap noted in
TM Section 3 (Repudiation), not blocking for this task **Data residency:** N/A
(in-process library, stores no data)

**Universal invariants reflected in scope:**

- N/A — DI library with no HTTP endpoints/Zod schemas/rate limits;
  application-level invariants do not apply here

---

## Dlaczego

**F-C4 (CRITICAL, zweryfikowane empirycznie na @nestjs/core@11.1.19):**
`vytches-ddd-feature.module.ts:75` umieszcza `ModulesContainer` w `providers`,
przez co NestJS tworzy świeżą, PUSTĄ mapę zamiast wstrzyknąć realny kontener z
InternalCoreModule (probe: size=0 z lokalnym providerem vs size=3 bez). Łańcuch
skutków:

- `FeatureHandlerRegistrar.findOwnModule()`
  (feature-handler-registrar.ts:108-134) iteruje zero modułów → `onModuleInit`
  (62-67) loguje warn i **pomija lokalną rejestrację**;
- handlery nie są "claimowane" → globalny explorer rejestruje je na globalnych
  busach — regresja dokładnie tego buga, który forFeature miał naprawić
  (ADR-0034);
- `ContextAwareEventDispatcher` (context-aware-event-dispatcher.ts:86-96) nadal
  kieruje zdarzenia domenowe do LOCAL_EVENT_BUS, **na którym nikt nie słucha**.

Testy tego nie łapią: `tests/feature/feature-handler-registrar.test.ts:57-80`
mockuje kontener ręcznie; `global-bus-acl.test.ts` nie woła `.init()`.

Fix zasadniczy to JEDNA LINIA (usunięcie ModulesContainer z providers — jest
globalnie injectable), ale task obejmuje też realny test e2e i naprawę
pozostałych zepsutych obietnic API modułu.

## Acceptance Criteria

1. [x] `ModulesContainer` usunięty z providers forFeature; lokalna rejestracja
       działa (handlery claimowane, LOCAL_EVENT_BUS ma słuchaczy).
2. [x] Test e2e z prawdziwym `Test.createTestingModule(...).compile()` +
       `app.init()` asertujący: (a) decorated handler ląduje na lokalnym busie,
       (b) zdarzenie domenowe dociera do handlera przez lokalny bus, (c) handler
       NIE jest zarejestrowany na globalnym busie.
3. [x] `forRootAsync()` faktycznie konsumuje `useFactory`/`inject`
       (vytches-ddd.module.ts:105-139) — albo jest usunięte z API przed
       publikacją (decyzja; F-H8). **Usunięte** (decyzja D-2, potwierdzone
       bezpieczne — konsument nie ma żadnych call-site'ów).
4. [x] `strictHandlerRegistration` osiągalne z `forContext()`/`forContexts()` —
       fabryki wołają `configureContext()` (obecnie `_contextOptions`
       write-only; F-M5).
5. [x] Guard przed podwójną rejestracją handlerów zdarzeń przy wielu instancjach
       explorera (forRoot + forContext; F-M5).
6. [x] Cleanup: `AutoDiscoveryService` (publiczny no-op) usunięty lub
       naprawiony; 6 martwych pól deprecated w types.ts:92-147 usuniętych;
       `contexts` od-deprecated lub poprawnie przekierowane (F-M15).
7. [x] Deep import `@nestjs/core/injector/modules-container.js` zastąpiony
       publicznym importem z `@nestjs/core` (F-M19).
8. [x] Regresja: istniejące testy nestjs zielone (215/215); walidacja na
       konsumencie — potwierdzona w analizie (OQ-3/OQ-4): konsument nie używa
       forFeature ani żadnej z pokrewnych fabryk, więc nie był narażony na F-C4
       w produkcji.

## Out of scope

- Wydajność adaptera kontenera — VP-006b (osobny task, potwierdzone linie w
  F-H12).

## References

- Analysis: `project-orchestration/analysis/LIB-AUDIT-2026-07-02.analysis.md`
  (F-C4, F-H8, F-M5, F-M15, F-M19 + Załącznik J)
- ADR-0034 (cross-context handler leakage — historia problemu)
