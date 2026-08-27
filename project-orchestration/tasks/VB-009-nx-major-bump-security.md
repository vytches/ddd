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
status: backlog
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

1. [ ] `nx` i WSZYSTKIE pakiety `@nx/*` (`@nx/eslint`, `@nx/eslint-plugin`,
       `@nx/jest`, `@nx/js`, `@nx/node`, `@nx/vite`, `@nx/devkit`,
       `@nx/workspace`) podniesione w lockstep do tej samej wersji `>=22.7.7`
       (Nx wymaga spójnych wersji w całej rodzinie pluginów — mieszanie majorów
       jest niewspierane i psuje się w nieoczywisty sposób).
2. [ ] `pnpm audit` — zero pozostałych wpisów dla `nx` (obie ścieżki:
       bezpośrednia i przez `lerna`). Jeśli `lerna@8.2.4` sam wciąga niezgodną
       wersję `nx` tranzytywnie mimo bumpa naszego devDependency, sprawdzić czy
       nowszy `lerna` (jeśli istnieje) rozwiązuje to bez override'a — override
       jako ostateczność, nie pierwszy wybór.
3. [ ] `pnpm run validate:types` (22/22 projektów) — zielone po bumpie.
4. [ ] `pnpm run lint` (`nx run-many --target=lint --all`) — zielone; Nx 22 mógł
       zmienić domyślne zachowanie/schemat konfiguracji ESLint executora —
       sprawdzić `.eslintrc`/`project.json` per pakiet pod kątem breaking
       changes we flagach.
5. [ ] Pełny `pnpm test` (`nx run-many --target=test --all`) — zielone dla
       wszystkich 19 pakietów bibliotecznych + `tools/`.
6. [ ] `pnpm run deps:circular`, `pnpm run quality` (oba quality gates) —
       zielone, bez regresji.
7. [ ] Sprawdzić istniejące ostrzeżenia peer-dependency z ostatniego
       `pnpm install` (`@nx/eslint-plugin` chce `eslint-config-prettier@^10`, ma
       `9.1.0`; `@nx/vite` chce `vitest@^1||^2||^3`, ma `4.1.9`) — Nx 22 może
       zaostrzyć te wymagania albo je rozluźnić; potwierdzić rzeczywisty stan po
       bumpie, nie zakładać że problem sam zniknie.

## Uwaga

To NIE jest zmiana dotykająca żadnego publikowanego pakietu `@vytches/ddd-*` —
`nx`/`@nx/*` są wyłącznie devDependencies narzędzia budowania monorepo. Zero
wpływu na publiczne API czy konsumentów. Ryzyko jest wyłącznie wewnętrzne: czy
pipeline build/lint/test całego repo (19 pakietów) przeżyje major bump
narzędzia, którego cała reszta configu (project.json per pakiet, nx.json, eslint
config) zakłada dzisiejszy schemat Nx 21.

## References

- `pnpm audit` (2026-08-27), pełny raport w transkrypcie sesji.
- Commit `383ce6de`
  (`fix(deps): close 10 of 14 pnpm audit findings via overrides`) — 10 z 14
  pierwotnych podatności już zamknięte, ten task domyka pozostałe 4.
