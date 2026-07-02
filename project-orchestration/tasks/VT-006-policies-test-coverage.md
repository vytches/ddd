# Task: Pokrycie testami policies + hardening pakietu testing

## Task Metadata

```yaml
task_id: VT-006
title: Policies decorators coverage (temporal/cached/retry) + testing pkg deepEqual/coverage
type: test
priority: normal
complexity: medium
estimated_time: 10h
created_by: LIB-AUDIT-2026-07-02
created_at: 2026-07-02
status: backlog
release_target: post-first-publish OK
package: '@vytches/ddd-policies', '@vytches/ddd-testing'
findings: [F-M10, F-M18]
```

## Dlaczego

**F-M10:** `policies` to największy pakiet (7083 LOC) z najgorszym stosunkiem
LOC/testy (~590 na plik testowy, 12 plików) — a jego najbardziej złożona
logika to dekoratory łączące timing, cache i retry (`temporal-policy.ts`
519 linii, `cached-policy.ts` 497, `retry-policy.ts` 457): dokładnie klasa
kodu najbardziej podatna na edge-case'y. To produkcyjna logika reguł
biznesowych — wyższy blast-radius niż dev-toolingowy `testing`
(4996 LOC / 6 testów), który jest drugi w kolejce.

Dodatkowo w `policies` publiczne metody rzucają
`new Error('not yet implemented')`: `.group()`
(base-business-policy.ts:267-269, 323-325), `.when().then()/.thenMust()`
(360-361, 368-369) — niekompletne API wystawione jako wywoływalne.

**F-M18:** `testing/src/gwt/event-matcher.ts:98-119` — lokalny `deepEqual`
bez guardu cykli/głębokości (stack overflow na cyklicznych fixture'ach);
`LibUtils.deepEqual` ma już WeakMap-owy guard.

## Acceptance Criteria

1. [ ] Dekoratory policies pokryte testami edge-case'ów: temporal (granice
       okien czasowych, strefy), cached (TTL, eviction LRU, współbieżność),
       retry (backoff, wyczerpanie prób, nieretryowalne błędy).
2. [ ] Decyzja o `.group()`/`.when().then()`: implementacja ALBO usunięcie
       z publicznego API przed pierwszą publikacją (skoordynować z VF-024) —
       koniec z "not yet implemented" w wywoływalnych metodach.
3. [ ] `event-matcher.ts` deepEqual: reuse `LibUtils.deepEqual` lub
       dodanie WeakMap/depth-guard; test na cykliczny fixture.
4. [ ] `test-harness.ts:274` console.log → internalLogger;
       `policy-event-bus.ts:356` console[logLevel] → internalLogger.
5. [ ] Coverage pakietu policies raportowane przed/po (cel: wyraźny wzrost
       na plikach dekoratorów; globalne 69,29% nie spada).

## Out of scope

- Pokrycie pakietu testing seederów (duże, osobna decyzja post-release —
  spójne z zamknięciem VT-001).

## References

- Analysis: `project-orchestration/analysis/LIB-AUDIT-2026-07-02.analysis.md`
  (F-M10, F-M18 + Załącznik C)
