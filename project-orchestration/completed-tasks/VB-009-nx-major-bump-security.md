# Task: Bump Nx 21 → 22 to close remaining pnpm audit findings

## Task Metadata

```yaml
task_id: VB-009
title: Bump nx + all @nx/* plugins from 21.2.3 to >=22.7.7 (security)
type: chore
priority: normal
complexity: medium
estimated_time: 3-5h
created_by: human (2026-08-27, during /pulse follow-up + pnpm audit triage)
created_at: 2026-08-27
status: done
release_target: post-first-publish OK
package:
  'workspace (build tooling — nx, @nx/eslint, @nx/eslint-plugin, @nx/jest,
  @nx/js, @nx/node, @nx/vite, @nx/devkit, @nx/workspace)'
```

## Dlaczego

`pnpm audit` (2026-08-27) znalazł 14 podatności w devDependencies. 10 z nich
naprawiono bezpośrednio przez poszerzenie/dodanie `pnpm.overrides` (`undici`,
`ip-address`, `body-parser`, `nanoid` — patrz commit `383ce6de`). Pozostałe **4
podatności są w `nx` samym** i **nie da się ich naprawić przez override**, bo —
w przeciwieństwie do `undici`/`ip-address` itd. — `nx` to nasz **bezpośredni,
realnie używany** devDependency (`nx: 21.2.3` w root `package.json`), nie
tranzytywna zależność narzędzia. Zawężony override targetujący tylko instancję
`nx` wciąganą przez `lerna` (transytywnie, `nx@20.8.4`) zamaskowałby audyt, ale
zostawiłby realne narzędzie builda (`nx@21.2.3`, którego używają WSZYSTKIE
skrypty `nx run-many --target=...` w tym repo) na podatnej wersji — weryfikacja
`pnpm why nx` potwierdza, że `21.2.3` mieści się w obu podatnych zakresach.

Podatności:

1. **High** — Nx: Zip-Slip w self-hosted remote cache (`nx` `>=20.8.0 <22.7.7`,
   patched `>=22.7.7`). https://github.com/advisories/GHSA-vp3h-ghgh-jr7g
2. **Moderate** — `nx graph` dev server permissive CORS policy (`nx`
   `>=17.0.4 <22.7.2`, patched `>=22.7.2`).
   https://github.com/advisories/GHSA-g2r8-wvmj-jf5w

(Audyt raportuje po 2 wpisy każdy — raz dla naszego bezpośredniego `nx@21.2.3`,
raz dla tranzytywnego `nx@20.8.4` wciąganego przez
`lerna@8.2.4 > @lerna/create@8.2.4 > @nx/devkit@20.8.4`.)

## Acceptance Criteria

1. [x] `nx` i WSZYSTKIE pakiety `@nx/*` podniesione w lockstep do `22.7.8`
       (najnowsza stabilna 22.x, przez `nx migrate 22.7.8`).
2. [x] `pnpm audit` — 0 wpisów. Nasz bezpośredni `nx` naprawiony bumpem;
       pozostałe 4 (2× `nx@20.8.4` przez `lerna`, `pacote`, `brace-expansion`)
       zamknięte punktowymi `pnpm.overrides` — bezpieczne tym razem, bo to
       izolowane wewnętrzne zależności `lerna`, nie nasz realny build tool.
3. [x] `pnpm run validate:types` — 22/22 zielone.
4. [x] `pnpm run lint` — 0 errors (11 pre-existing warningów bez zmian). Nx 22
       poprawił regułę `@nx/enforce-module-boundaries`, żeby analizowała też
       dynamiczne `require()` — ujawniło 6 realnych, wcześniej niewidocznych
       naruszeń granic w `@vytches/ddd-testing`
       (`require('@vytches/ddd-value-objects')`, już zadeklarowana zależność w
       `package.json`). Naprawione przez `eslint-disable-next-line` per linia
       (nie edycję chronionego `.eslintrc.json`).
5. [x] Pełny `pnpm test` — 26/26 projektów zielone.
6. [x] `pnpm run deps:circular`, `pnpm run quality` — oba zielone, bez regresji.
7. [x] Peer-dependency warnings sprawdzone: pozostały te same co przed bumpem
       (`@nx/eslint-plugin` chce `eslint-config-prettier@^10`, ma `9.1.0`;
       `typescript-eslint` chce `typescript <5.9.0`, mamy `5.9.3`) —
       nieblokujące, niezmienione przez ten task, osobna sprawa.

## Uwaga

To NIE jest zmiana dotykająca żadnego publikowanego pakietu `@vytches/ddd-*` —
`nx`/`@nx/*` są wyłącznie devDependencies narzędzia budowania monorepo. Zero
wpływu na publiczne API czy konsumentów.

## Zamknięcie (2026-08-30)

Zrobione bezpośrednio (bez `/analyze`) na wyraźne polecenie użytkownika —
mechaniczny bump z jasną ścieżką weryfikacji (build→lint→test→quality gates),
nie decyzja architektoniczna wymagająca panelu.

**Kolejność realna**: `nx migrate latest` (23.1.2) najpierw wypróbowany i
odrzucony — wymuszał migrację testów z `@nx/vite` na `@nx/vitest` ORAZ kilka
migracji zakładających TypeScript ≥6/Vite ≥8, których projekt nie ma.
Retargetowano na `nx migrate 22.7.8` (najnowsza stabilna 22.x) — nadal wymusza
przejście na `@nx/vitest:test` (to zmiana obowiązująca od 22.2.0, nie specyfika
`latest`), ale reszta migracji ograniczona do kosmetyki
(`.gitignore`/`.prettierignore`, drobne dodatki inputs executora lint).
`nx migrate --run-migrations` w trybie nieinteraktywnym padał na promptach
(`yes "n" | nx migrate ...` psuło parsowanie CLI) — ostatecznie zadziałało bez
pipowania stdin.

Pozostałe po bumpie 4 podatności okazały się być WYŁĄCZNIE w prywatnym, starym
bundlu `nx@20.8.4` wewnątrz `lerna` (plus `pacote`, `brace-expansion`) — nasz
własny `nx@22.7.8` był już czysty. To odróżnia tę sytuację od stanu przed bumpem
(gdzie override byłby maskowaniem realnie podatnego narzędzia) — punktowy
`pnpm.overrides` na te 3 pakiety jest tu bezpieczny, bo `lerna`'s internal
tooling nie jest wołane przez nasz pipeline build/lint/test.

`pnpm audit`: **0 podatności** (z 14 na starcie tej serii, przez oba commity —
`383ce6de` i `84c112fc`).

Commit: `84c112fc` na `develop`.
