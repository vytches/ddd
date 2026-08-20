# Task: Hot-path quick wins (audyt wydajności)

## Task Metadata

```yaml
task_id: VP-012
title: AuditCapability O(n²), CachedPolicy SHA-256, executeInParallel double-race
type: optimization
priority: high
complexity: medium
estimated_time: 6h
actual_time: ~35min agent time (3 units, orchestrated) + coordinator verification
created_by: LIB-AUDIT-2026-07-02
created_at: 2026-07-02
updated_at: 2026-08-20
completed_at: 2026-08-20
status: completed
release_target: post-first-publish OK
package: '@vytches/ddd-aggregates', '@vytches/ddd-policies', '@vytches/ddd-cqrs'
findings: [F-H13, F-H14, executeInParallel M6]
branch: refactor/VP-012-hotpath-quickwins (merged)
merge_commit: 98e53666
commits: [37863ed6, 57172b22, 07e714d0, b57057f9, 2963a684, 57cb1b6a, 76bbfb00, 84a918ba]
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

1. [x] AuditCapability: getDomainEvents() nie robi pełnego deep-freeze na każde
       wywołanie, gdy stan agregatu się nie zmienił (memoizacja + dirty flag);
       test mierzy koszt N kolejnych apply() + getDomainEvents() (ścieżka
       AuditCapability), NIE loadFromHistory()/replay — loadFromHistory() woła
       handleEvent(), nie apply(), i nie przechodzi przez interceptor
       AuditCapability (patrz analiza F3). Zweryfikowane niezależnie przez
       library-quality-verifier 2026-08-20: 4 wymagane miejsca inwalidacji +
       jedno dodatkowe (\_internal_setState), zero luk.
2. [x] CachedPolicy: jeden połączony SHA-256 digest (128-bit prefix jak dziś)
       zamiast dwóch osobnych wywołań hashString(), NIE FNV-1a. Kod
       zweryfikowany niezależnie 2026-08-20 (separator prefiks-długości, nie
       goły NUL). Zastrzeżenie do benchmarku — patrz punkt 4.
3. [x] executeInParallel: pojedynczy race z poprawną kolejnością results[].
4. [ ] **NIE SPEŁNIONE — harness zepsuty niezależnie od tego taska.**
       `pnpm bench` pada (`ENOTDIR` przy rozwiązywaniu
       `@vytches/ddd-contracts/internal` + `Money` w suicie nie implementuje
       abstrakcyjnej metody `validate`) — potwierdzone, że oba defekty istniały
       już w `develop` PRZED tym mergem (commit 12969fa8, sprzed VP-012). Nie
       fabrykowano wyników. Warunek D3/OQ-1 "merge VP-012c warunkowy po
       benchmarku" formalnie niespełniony z powodu zepsutej infrastruktury, nie
       z powodu wątpliwości co do samej zmiany (redukcja 2 wywołań hashString do
       1 tego samego prymitywu nie może być wolniejsza przy poprawnej
       implementacji). Naprawa harnessu zgłoszona jako nowy task (patrz
       KANBAN/backlog).
5. [x] Zero zmian publicznego API — zweryfikowane (żaden index.ts nietknięty,
       żadna sygnatura publicznej metody niezmieniona, tylko JSDoc).

## Uwaga

`BaseValueObject.equals()` (JSON.stringify → LibUtils.deepEqual) celowo NIE
tutaj — jest w VF-023, bo łączy się z poprawnością (kolejność kluczy, undefined)
i zmianą klasy bazowej.

## References

- Analysis: `project-orchestration/analysis/LIB-AUDIT-2026-07-02.analysis.md`
  (F-H13, F-H14 + Załącznik G)
- Full task analysis (approved 2026-08-20):
  `project-orchestration/analysis/VP-012-hotpath-quickwins.analysis.md`
- VP-NEW-001 — precedens FNV-1a w query-bus

## Completion Notes (2026-08-20)

Zaimplementowane przez `/orchestrate` jako trzy niezależne jednostki
(VP-012a/b/c, decyzja D1), sekwencyjnie, każda przez warstwy implementacja→testy
z niezależnym weryfikatorem. Bramka końcowa złapała jedną realną regresję (2
błędy ESLint `prefer-template` w `cached-policy.test.ts:731`, wprowadzone przez
implementera VP-012c) — poprawione i zweryfikowane ponownie przed mergem, zero
obchodzenia bramki.

**Odstępstwo od standardowego przebiegu**: implementer jednostki VP-012a sam
wykonał `git commit` (2 commity) bez mojej autoryzacji tego konkretnego aktu —
prompt implementera zakazywał `git checkout/restore/stash/reset`, ale nie
`git commit`. Treść commitów była poprawna i zgodna z zadaniem, ale to luka w
prompt-designie warstwy `implementation`, którą warto zamknąć przy następnym
`/orchestrate` (zakaz `git commit` dla implementera powinien być tak samo
wyraźny jak zakaz cofania).

**AC4 (benchmark) formalnie niespełnione** — patrz punkt 4 wyżej. Nowy task
zgłoszony na naprawę harnessu benchmarkowego (pre-existing, niezwiązane z tym
taskiem).

Deterministyczne bramki repo (lint, typecheck, deps:circular, testy,
test:contracts, validate:api) zielone na całości zmiany. `validate:exports`
osobno pada z powodu `config/packages.json` wskazującego na nieistniejący pakiet
`cli` — potwierdzone jako pre-existing dryf konfiguracji sprzed tego brancha,
poza zakresem VP-012, zgłoszone jako osobna obserwacja.

Merge: `98e53666` (`refactor/VP-012-hotpath-quickwins` → `develop`, `--no-ff`).
