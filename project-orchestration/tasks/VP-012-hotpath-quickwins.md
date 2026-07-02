# Task: Hot-path quick wins (audyt wydajności)

## Task Metadata

```yaml
task_id: VP-012
title: AuditCapability O(n²), CachedPolicy SHA-256, executeInParallel double-race
type: optimization
priority: normal
complexity: simple
estimated_time: 6h
created_by: LIB-AUDIT-2026-07-02
created_at: 2026-07-02
status: backlog
release_target: post-first-publish OK
package: '@vytches/ddd-aggregates', '@vytches/ddd-policies', '@vytches/ddd-cqrs'
findings: [F-H13, F-H14, executeInParallel M6]
```

## Dlaczego

Trzy izolowane, niskoryzykowne poprawki o realnym koszcie u konsumenta
skali juz-ide-api (237+ agregatów, policy-check na każdej komendzie):

1. **F-H13 — O(n²) replay z AuditCapability:**
   `audit-capability.ts:73-85,145-155` woła `getDomainEvents()` po KAŻDYM
   `apply()`, a getter robi pełną kopię spread
   (aggregate-root.ts:175-177) tylko po to, by odczytać ostatni element.
   Replay N zdarzeń = 1+2+...+N kopii. Fix: odczyt
   `_domainEvents[length-1]` wewnętrznie lub `peekLastEvent()` bez kopii.
2. **F-H14 — CachedPolicy hashuje kryptograficznie na każdym checku:**
   `cached-policy.ts:283-309` robi `JSON.stringify(request.entity)` +
   2× `await crypto.subtle.digest('SHA-256', ...)` per sprawdzenie
   autoryzacji. Cel (brak surowego PII w kluczach cache) nie wymaga
   collision-resistance — szybki synchroniczny hash (FNV-1a — precedens:
   enhanced-query-bus.ts:711-725, VP-NEW-001, zmierzone 5-10× szybciej)
   spełnia to samo bez skoku w microtask.
3. **executeInParallel — podwójny Promise.race:**
   `enhanced-command-bus.ts:616-639` — wynik pierwszego race'a odrzucany,
   drugi race tylko po indeks. Jedna race z indeksem wystarczy.

## Acceptance Criteria

1. [ ] AuditCapability bez kopii tablicy na apply(); test replay N=1000
       zdarzeń z audytem — czas liniowy (benchmark before/after).
2. [ ] CachedPolicy: synchroniczny szybki hash zamiast 2× SHA-256;
       zachowany cel prywatności (brak surowych wartości encji w kluczach);
       benchmark before/after.
3. [ ] executeInParallel: pojedynczy race.
4. [ ] `pnpm bench` (hot-paths + di) bez regresji; wyniki w opisie PR.
5. [ ] Zero zmian publicznego API (wewnętrzne implementacje).

## Uwaga

`BaseValueObject.equals()` (JSON.stringify → LibUtils.deepEqual) celowo NIE
tutaj — jest w VF-023, bo łączy się z poprawnością (kolejność kluczy,
undefined) i zmianą klasy bazowej.

## References

- Analysis: `project-orchestration/analysis/LIB-AUDIT-2026-07-02.analysis.md`
  (F-H13, F-H14 + Załącznik G)
- VP-NEW-001 — precedens FNV-1a w query-bus
