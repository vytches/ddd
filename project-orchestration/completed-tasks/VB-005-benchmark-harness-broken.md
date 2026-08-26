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
status: done
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

1. [x] `pnpm run bench` uruchamia się bez błędu (exit 0) i faktycznie wykonuje
       wszystkie `bench()` w `benchmarks/suites/hot-paths.bench.ts`.
       Zweryfikowane realnym uruchomieniem: exit 0, 11/11 wyników w 5 blokach
       `describe`.
2. [x] Naprawiony import `@vytches/ddd-contracts/internal` (i inne subpath
       exporty używane w suicie) — bez obchodzenia przez zmianę importu na
       ścieżkę względną (to ukryłoby problem configu zamiast go naprawić).
3. [x] `Money` w suicie implementuje `validate()` (albo suita używa realnej
       klasy wartości z biblioteki zamiast lokalnego, niepełnego przykładu).
4. [x] Krótka notatka w `benchmarks/README.md`, jak lokalnie zweryfikować że
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

## Zamknięcie (2026-08-25)

**Root cause był INNY niż hipoteza w tasku.** Nie `tsconfig.json`/`rootDir` —
`benchmarks/vitest.config.mts` miał `resolve.alias` w formie OBIEKTU mapującego
każdy pakiet workspace na konkretny plik `index.ts`. Mechanizm dopasowania
aliasu w Vite/rollup-plugin-alias
(`importee === find || importee.startsWith(find + "/")`, potem
`.replace(find, replacement)`) podmieniał dopasowany prefiks i doklejał resztę
ścieżki subpath exportu na końcu — dając dokładnie `.../src/index.ts/internal` z
błędu w tasku. Vitest/esbuild nie czyta tsconfig `paths`/`rootDir` przy
resolution w runtime.

**Naprawa**: `resolve.alias` przepisany na formę TABLICOWĄ, z wpisami subpath
(`@vytches/ddd-contracts/internal`, `@vytches/ddd-events/internal`) PRZED
wpisami bazowymi — dokładnie ten sam kształt, który to repo już raz zastosowało
pod VF-024 w root `vitest.config.mts` i
`packages/nestjs/vitest.bench.config.ts`. `events/internal` był drugą,
nieodkrytą pierwotnie w tasku miną tego samego rodzaju
(`packages/events/src/index.ts` sam importuje własny subpath internal) —
naprawiona w tym samym commicie, zamiast czekać na osobne zgłoszenie.

`Money.validate()` dodane, oparte wyłącznie na parametrze `value` (nigdy na
polach `this` — konstruktor bazowy woła `validate()` przed inicjalizacją pól
podklasy).

Panel analizy (`ecc:architect` + `backend-technology-expert` +
`library-api-guardian` + synteza `tech-lead`) rozważył alternatywę — alias na
katalog `src/` generowany dynamicznie, pokrywający systemowo każdy przyszły
subpath — i ją odrzucił: czyniłaby importowalnym każdy plik z 22 pakietów
zamiast 5-7 zadeklarowanych, więc benchmark przestałby wykrywać dryf zależności
(D1 w artefakcie analizy).

Weryfikacja: realne uruchomienie `pnpm run bench` (nie tylko przegląd kodu)
przez warstwę verify i niezależnie przez bramkę końcową
`library-quality-verifier` — oba GO. Świadomie odłożone bez uszczerbku
(odpowiedzi na `open_questions` analizy): automatyzacja `bench` w CI,
odświeżenie `benchmarks/baseline.json`, target `type-check` dla `benchmarks/`.

Commit `bf8d54cc` na `fix/VB-005-benchmark-harness-broken`. Artefakt analizy:
`project-orchestration/analysis/VB-005-benchmark-harness-broken.analysis.md`.
