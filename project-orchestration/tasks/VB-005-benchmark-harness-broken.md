# Task: Benchmark harness is broken (pnpm bench fails to run at all)

## Task Metadata

```yaml
task_id: VB-005
title:
  Fix broken benchmarks package — module resolution + stale Money bench class
type: bug
priority: high
complexity: medium
estimated_time: 2-3h
created_by: agent (orchestrate VP-012-hotpath-quickwins, discovered 2026-08-20)
created_at: 2026-08-20
status: backlog
release_target: post-first-publish OK
package: '@vytches/benchmarks'
```

## Dlaczego

Podczas zamykania VP-012-hotpath-quickwins próba spełnienia AC4 ("`pnpm bench`
bez regresji") ujawniła, że `pnpm run bench` **nie uruchamia się w ogóle** — i
to niezależnie od VP-012. Potwierdzone przez `git show 12969fa8:...` (tip
`develop` sprzed mergu VP-012), że oba defekty istniały już wcześniej:

1. **Błąd rozwiązywania modułu**: `benchmarks/suites/hot-paths.bench.ts`
   importuje `@vytches/ddd-aggregates`, które transytywnie importuje
   `@vytches/ddd-contracts/internal`. Przy uruchomieniu z workspace'u
   `benchmarks` kończy się to
   `ENOTDIR: not a directory, open '.../packages/contracts/src/index.ts/internal'`
   — subpath export `/internal` nie jest poprawnie rozwiązywany w kontekście
   tsconfig/vitest configu paczki `benchmarks` (najpewniej niezgodność
   `rootDir`/mapowania ścieżek z resztą monorepo — `benchmarks/tsconfig.json` ma
   `rootDir: "."`, a importuje pliki spoza tego katalogu).
2. **Martwa klasa w suicie**: `Money` (w `hot-paths.bench.ts`) rozszerza
   `BaseValueObject<MoneyProps>` i nie implementuje wymaganej abstrakcyjnej
   metody `validate` — realny błąd typów, złapany przez diagnostykę IDE, nie
   tylko przez runtime.

Efekt: żadna z suit benchmarkowych (`hot-paths`, w tym nowo dodany blok dla
`CachedPolicy.generateCacheKey()` z VP-012c) nigdy realnie nie działała przez
`pnpm run bench`. Wszystkie AC w historii projektu wymagające dowodu
benchmarkowego "przed/po" (np. VP-012 AC4) są dziś niespełnialne bez tej naprawy
— nie da się ich uczciwie zamknąć liczbami.

## Acceptance Criteria

1. [ ] `pnpm run bench` uruchamia się bez błędu (exit 0) i faktycznie wykonuje
       wszystkie `bench()` w `benchmarks/suites/hot-paths.bench.ts`.
2. [ ] Naprawiony import `@vytches/ddd-contracts/internal` (i inne subpath
       exporty używane w suicie) — bez obchodzenia przez zmianę importu na
       ścieżkę względną (to ukryłoby problem configu zamiast go naprawić).
3. [ ] `Money` w suicie implementuje `validate()` (albo suita używa realnej
       klasy wartości z biblioteki zamiast lokalnego, niepełnego przykładu).
4. [ ] Krótka notatka w `benchmarks/README.md`, jak lokalnie zweryfikować że
       harness działa PRZED poleganiem na nim w kolejnym tasku (żeby ten sam
       problem nie powtórzył się cicho).

## Uwaga

Nie jest to regresja z VP-012 — potwierdzone przez `git show` na tipie `develop`
sprzed mergu VP-012 (commit `12969fa8`). To pre-existing dług infrastrukturalny,
prawdopodobnie od momentu dodania paczki `benchmarks`.

## References

- Odkryte przy:
  `project-orchestration/completed-tasks/VP-012-hotpath-quickwins.md`
  (Completion Notes, 2026-08-20)
