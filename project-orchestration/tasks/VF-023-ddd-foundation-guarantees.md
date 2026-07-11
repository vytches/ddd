# Task: Gwarancje strukturalne fundamentów DDD (ValueObject, AggregateRoot)

## Task Metadata

```yaml
task_id: VF-023
title: BaseValueObject always-valid + AggregateRoot atomic apply + internal-state lock
type: bug
priority: high
complexity: complex
estimated_time: 12h
created_by: LIB-AUDIT-2026-07-02
created_at: 2026-07-02
status: backlog
release_target: pre-first-public-publish (BC window — po publikacji to breaking changes)
package: '@vytches/ddd-value-objects', '@vytches/ddd-aggregates'
findings: [F-C5, F-C6, F-H4, F-H5, F-M2, SA-M7, SA-M9, UX-C15, UX-C18]
```

---

## 🔒 Security Pre-Analysis

**Granularity:** Feature TM (adapted for library context — no HTTP endpoints, no
PII, no auth) **TM file:**
[`docs/security/threat-models/TM-VF-023.md`](../../docs/security/threat-models/TM-VF-023.md)
**Status:** DRAFT — pending Tech Lead sign-off **Date:** 2026-07-11

**Findings summary** (z TM file):

- 1 CRITICAL threat (DREAD 13) — `_internal_setState` public invariant-bypass
  (F-H4) — see TM Sekcja 5, covered by AC5
- 5 HIGH threats (DREAD 10-11) — silent event drop live+replay (F-M2/SA-M7,
  AC6), non-atomic optimistic concurrency (SA-M9, AC9), version desync on
  throw+retry (F-C6, AC4), `validate()` never invoked (F-C5, AC1), shallow
  freeze + unreliable `equals()` (F-H5, AC2/AC3)
- Mitigations integrated into scope: `value-objects/src/base-value-object.ts`,
  `aggregates/src/aggregate-root.ts`,
  `contracts/src/events/event-persistence-handler.interface.ts`,
  `repositories/src/base-repository.ts`

**PII categories:** none (pure domain-primitives library, no PII of its own)
**Lawful basis (RODO Art. 6):** N/A **DPIA required:** NO (no PII processed by
this scope)

**Audit trail:** N/A — library has no its own audit/event-emission mechanism
outside what AC6 fixes **Data residency:** N/A

**Universal invariants reflected in scope:**

- N/A — invariants table (userId in Zod schemas, `@Auth()`, rate limiting)
  targets HTTP-application code; this task is a library-internal invariant fix.
  See TM Section "Scoping note" for the adapted STRIDE/DREAD analysis used
  instead.

---

## Dlaczego

Trzy wady w najbardziej fundamentalnych klasach biblioteki zamieniają gwarancje
DDD w konwencje. Konsument (juz-ide-api: 237+ agregatów) polega na nich
implicite.

1. **F-C5 (CRITICAL):** `BaseValueObject` (base-value-object.ts:8-15) ma
   abstrakcyjne `validate()`, ale konstruktor NIGDY go nie woła (grep: wywołania
   tylko w testach). Można skonstruować niepoprawny VO bez błędu — "always-valid
   domain model" nie jest gwarantowany strukturalnie.
2. **F-C6 (CRITICAL):** `AggregateRoot.apply()` inkrementuje `_version`
   (aggregate-root.ts:219) PRZED guardem maxEvents (255-262). Throw guardu →
   agregat z podbitą wersją bez zdarzenia i bez mutacji stanu; przy retry
   (middleware) wersja cicho rozjeżdża się z historią → psuje optimistic
   concurrency.
3. **F-H4:** `_internal_setState()` (aggregate-root.ts:397-405) jest publiczne —
   dowolny kod omija wszystkie inwarianty
   (`aggregate._internal_setState({version: 99999, ...})`). Legalny użytkownik
   to tylko SnapshotCapability (snapshot-capability.ts:170-176).
4. **F-H5:** freeze VO jest płytki (komentarz twierdzi "Deep freeze",
   base-value-object.ts:9-11) — `vo.getValue().nested.push(x)` działa;
   `equals()` przez `JSON.stringify` (23-38) — zależne od kolejności kluczy,
   gubi `undefined`, psuje Date/Map/Set, wolniejsze niż istniejący
   `LibUtils.deepEqual` (benchmark już jest: hot-paths.bench.ts:80-91).
5. **F-M2:** brak handlera zdarzenia w `apply()` = cichy no-op (zdarzenie
   zapisane, stan niezmieniony; aggregate-root.ts:268-280) — sprzeczne z zasadą
   "never swallow errors silently".
6. **SA-M7 (SEC-AUDIT-2026-07-09):** ta sama ścieżka `handleEvent()` obsługuje
   replay — `loadFromHistory()` (aggregate-root.ts:286-296) cicho pomija
   zdarzenie o nieznanym `eventName`: cicha utrata danych na
   uszkodzonym/przemianowanym streamie zdarzeń. Fix F-M2 musi jawnie objąć też
   stronę replay.
7. **SA-M9 (SEC-AUDIT-2026-07-09):** luka kontraktu optymistycznej
   współbieżności — `IEventPersistenceHandler`
   (contracts/src/events/event-persistence-handler.interface.ts:9-20) nie
   dokumentuje wymogu atomowości/compare-and-set, a `BaseRepository.save`
   (repositories/src/base-repository.ts:41-72) robi nieatomowe check-then-act:
   dwa równoległe `save()` mogą oba przejść walidację wersji (lost update), o
   ile handler konsumenta sam z siebie nie jest atomowy.

## Acceptance Criteria

1. [ ] Konstruktor `BaseValueObject` wywołuje `this.validate(value)` (throw lub
       statyczna fabryka `Result<VO, Error>` — decyzja projektowa w fazie
       analizy; ocenić wpływ na istniejące VO konsumenta).
2. [ ] Głęboki freeze wartości obiektowych LUB jawna zmiana komentarza/docs na
       "shallow freeze" + udokumentowana decyzja (zważyć koszt perf).
3. [ ] `equals()` przez `LibUtils.deepEqual`; benchmark before/after
       (hot-paths.bench.ts) w opisie PR.
4. [ ] `apply()`: wszystkie guardy PRZED mutacją `_version`/`_domainEvents` —
       agregat nigdy nie zostaje częściowo zmutowany po wyjątku; test na
       scenariusz throw-and-retry.
5. [ ] `_internal_setState` niedostępne z publicznego API — mechanizm
       capability-only (module-private Symbol lub WeakMap-registry);
       Snapshot/VersioningCapability działają bez zmian.
6. [ ] Brakujący handler w `apply()` **oraz w `loadFromHistory()` (replay,
       SA-M7)**: konfigurowalny warn (domyślnie) / throw (strict) zamiast
       cichego no-op; test replay ze streamem zawierającym nieznany `eventName`.
7. [ ] BC assessment (library-api-guardian) dla każdej zmiany; aktualizacja
       snapshotów api-surface tam, gdzie sygnatury się zmieniają.
8. [ ] Walidacja na juz-ide-api (build && test) przed merge — zmiany dotykają
       klas bazowych 237+ agregatów.
9. [ ] **SA-M9:** JSDoc `IEventPersistenceHandler` jawnie wymaga atomowego,
       wersjonowanego zapisu (compare-and-set na expectedVersion) — inaczej
       "optimistic concurrency" biblioteki nie daje żadnej gwarancji; LLMGUIDE
       repositories/contracts zaktualizowane (doc-only, bez zmiany sygnatur).
10. [ ] **UX-C15 (LIB-UX-AUDIT-2026-07-10):** `AggregateRoot.equals()` dodane
        (parytet z `Entity.equals()`, identity po `_id.equals()`) — własny JSDoc
        klasy (aggregate-root.ts:32-35) już twierdzi, że istnieje; czysta
        addycja, non-breaking.
11. [ ] **UX-C18 (LIB-UX-AUDIT-2026-07-10):** `getDomainEvents()` zwraca tylko
        płytką kopię tablicy (aggregate-root.ts:175-177) — mutacja
        `event.payload` przez konsumenta sięga wewnętrznego stanu pending
        events; rozstrzygnąć razem z AC2 (deep freeze vs udokumentowane shallow)
        — jedna spójna decyzja dla VO i eventów.

## Out of scope

- Domyślny branding EntityId (BrandedId jako główna ścieżka) — kandydat na
  osobny task po dyskusji API.
- CQRS type-safe register (F-M1) — VF-025.

## References

- Analysis: `project-orchestration/analysis/LIB-AUDIT-2026-07-02.analysis.md`
  (F-C5, F-C6, F-H4, F-H5, F-M2 + Załącznik E)
- Analysis: `project-orchestration/analysis/SEC-AUDIT-2026-07-09.analysis.md`
  (SA-M7, SA-M9)
