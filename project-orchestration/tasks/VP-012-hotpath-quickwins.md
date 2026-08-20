# Task: Hot-path quick wins (audyt wydajności)

## Task Metadata

```yaml
task_id: VP-012
title: AuditCapability O(n²), CachedPolicy SHA-256, executeInParallel double-race
type: optimization
priority: high
complexity: medium
estimated_time: 6h
created_by: LIB-AUDIT-2026-07-02
created_at: 2026-07-02
status: backlog
release_target: post-first-publish OK
package: '@vytches/ddd-aggregates', '@vytches/ddd-policies', '@vytches/ddd-cqrs'
findings: [F-H13, F-H14, executeInParallel M6]
```

## Dlaczego

Trzy izolowane, niskoryzykowne poprawki o realnym koszcie u konsumenta skali
juz-ide-api (237+ agregatów, policy-check na każdej komendzie):

1. **F-H13 — O(n²) w getDomainEvents(), wołanym po każdym apply():**
   `audit-capability.ts` woła `getDomainEvents()` po KAŻDYM `apply()`. Getter
   dziś (implementacja VF-023) robi `.map(event => LibUtils.deepFreeze(event))`
   - `Object.freeze()` na całej tablicy przy KAŻDYM wywołaniu — droższe niż
     kopia przez spread, nie tańsze. N kolejnych apply() z audytem = O(N²)
     deep-freeze. Fix: memoizacja zamrożonej tablicy w
     AggregateRoot.getDomainEvents + inwalidacja przy mutacji (korekta ustalona
     empirycznie w
     `project-orchestration/analysis/VP-012-hotpath-quickwins.analysis.md`,
     F1_KOREKTA, decyzja D2).
2. **F-H14 — CachedPolicy hashuje kryptograficznie na każdym checku:**
   `cached-policy.ts:283-309` robi `JSON.stringify(request.entity)` + 2×
   wywołania `hashString()` (SHA-256, 128-bit prefix) per sprawdzenie
   autoryzacji. Fix zaakceptowany: jeden połączony digest zamiast dwóch — NIE
   FNV-1a. Bare FNV-1a odrzucony po analizie ryzyka jako regres bezpieczeństwa
   (kolizja w 32-bitowym kontekście → cross-tenant data disclosure; patrz
   analiza D3).
3. **executeInParallel — podwójny Promise.race:**
   `enhanced-command-bus.ts:616-639` — wynik pierwszego race'a odrzucany, drugi
   race tylko po indeks. Jedna race z indeksem wystarczy.

## Acceptance Criteria

1. [ ] AuditCapability: getDomainEvents() nie robi pełnego deep-freeze na każde
       wywołanie, gdy stan agregatu się nie zmienił (memoizacja + dirty flag);
       test mierzy koszt N kolejnych apply() + getDomainEvents() (ścieżka
       AuditCapability), NIE loadFromHistory()/replay — loadFromHistory() woła
       handleEvent(), nie apply(), i nie przechodzi przez interceptor
       AuditCapability (patrz analiza F3).
2. [ ] CachedPolicy: jeden połączony SHA-256 digest (128-bit prefix jak dziś)
       zamiast dwóch osobnych wywołań hashString(), NIE FNV-1a; benchmark
       before/after warunkuje merge (zysk musi przewyższać dominujący koszt
       JSON.stringify(request.entity)).
3. [ ] executeInParallel: pojedynczy race.
4. [ ] `pnpm bench` (hot-paths + di) bez regresji; wyniki w opisie PR.
5. [ ] Zero zmian publicznego API (wewnętrzne implementacje).

## Uwaga

`BaseValueObject.equals()` (JSON.stringify → LibUtils.deepEqual) celowo NIE
tutaj — jest w VF-023, bo łączy się z poprawnością (kolejność kluczy, undefined)
i zmianą klasy bazowej.

## References

- Analysis: `project-orchestration/analysis/LIB-AUDIT-2026-07-02.analysis.md`
  (F-H13, F-H14 + Załącznik G)
- VP-NEW-001 — precedens FNV-1a w query-bus
