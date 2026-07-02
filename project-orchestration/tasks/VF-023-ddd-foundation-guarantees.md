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
findings: [F-C5, F-C6, F-H4, F-H5, F-M2]
```

## Dlaczego

Trzy wady w najbardziej fundamentalnych klasach biblioteki zamieniają
gwarancje DDD w konwencje. Konsument (juz-ide-api: 237+ agregatów) polega
na nich implicite.

1. **F-C5 (CRITICAL):** `BaseValueObject` (base-value-object.ts:8-15) ma
   abstrakcyjne `validate()`, ale konstruktor NIGDY go nie woła (grep:
   wywołania tylko w testach). Można skonstruować niepoprawny VO bez błędu —
   "always-valid domain model" nie jest gwarantowany strukturalnie.
2. **F-C6 (CRITICAL):** `AggregateRoot.apply()` inkrementuje `_version`
   (aggregate-root.ts:219) PRZED guardem maxEvents (255-262). Throw guardu →
   agregat z podbitą wersją bez zdarzenia i bez mutacji stanu; przy retry
   (middleware) wersja cicho rozjeżdża się z historią → psuje optimistic
   concurrency.
3. **F-H4:** `_internal_setState()` (aggregate-root.ts:397-405) jest
   publiczne — dowolny kod omija wszystkie inwarianty
   (`aggregate._internal_setState({version: 99999, ...})`). Legalny
   użytkownik to tylko SnapshotCapability (snapshot-capability.ts:170-176).
4. **F-H5:** freeze VO jest płytki (komentarz twierdzi "Deep freeze",
   base-value-object.ts:9-11) — `vo.getValue().nested.push(x)` działa;
   `equals()` przez `JSON.stringify` (23-38) — zależne od kolejności kluczy,
   gubi `undefined`, psuje Date/Map/Set, wolniejsze niż istniejący
   `LibUtils.deepEqual` (benchmark już jest: hot-paths.bench.ts:80-91).
5. **F-M2:** brak handlera zdarzenia w `apply()` = cichy no-op (zdarzenie
   zapisane, stan niezmieniony; aggregate-root.ts:268-280) — sprzeczne
   z zasadą "never swallow errors silently".

## Acceptance Criteria

1. [ ] Konstruktor `BaseValueObject` wywołuje `this.validate(value)`
       (throw lub statyczna fabryka `Result<VO, Error>` — decyzja
       projektowa w fazie analizy; ocenić wpływ na istniejące VO
       konsumenta).
2. [ ] Głęboki freeze wartości obiektowych LUB jawna zmiana komentarza/docs
       na "shallow freeze" + udokumentowana decyzja (zważyć koszt perf).
3. [ ] `equals()` przez `LibUtils.deepEqual`; benchmark before/after
       (hot-paths.bench.ts) w opisie PR.
4. [ ] `apply()`: wszystkie guardy PRZED mutacją `_version`/`_domainEvents` —
       agregat nigdy nie zostaje częściowo zmutowany po wyjątku; test na
       scenariusz throw-and-retry.
5. [ ] `_internal_setState` niedostępne z publicznego API — mechanizm
       capability-only (module-private Symbol lub WeakMap-registry);
       Snapshot/VersioningCapability działają bez zmian.
6. [ ] Brakujący handler w `apply()`: konfigurowalny warn (domyślnie) /
       throw (strict) zamiast cichego no-op.
7. [ ] BC assessment (library-api-guardian) dla każdej zmiany; aktualizacja
       snapshotów api-surface tam, gdzie sygnatury się zmieniają.
8. [ ] Walidacja na juz-ide-api (build && test) przed merge — zmiany dotykają
       klas bazowych 237+ agregatów.

## Out of scope

- Domyślny branding EntityId (BrandedId jako główna ścieżka) — kandydat na
  osobny task po dyskusji API.
- CQRS type-safe register (F-M1) — VF-025.

## References

- Analysis: `project-orchestration/analysis/LIB-AUDIT-2026-07-02.analysis.md`
  (F-C5, F-C6, F-H4, F-H5, F-M2 + Załącznik E)
