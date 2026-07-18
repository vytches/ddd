# Task: Publish Integrity Pipeline — naprawa buildu/packagingu + smoke test w CI

## Task Metadata

```yaml
task_id: VB-002
title:
  Fix broken published artifacts (.d.ts, ESM, deps) + consumer smoke test in CI
type: bug
priority: critical
complexity: complex
estimated_time: 16h
created_by: LIB-AUDIT-2026-07-02
created_at: 2026-07-02
updated_at: 2026-07-02
status: done
release_target: pre-first-public-publish (blocks any npm publish)
package:
  build-configs (utils), testing, cqrs, di, events, domain-services, all 19
  manifests
findings: [F-C1, F-C2, F-C3, F-H1, F-H6, F-H15, F-M7, F-M8, F-M20]
```

## Dlaczego

Audyt LIB-AUDIT-2026-07-02 wykazał, że **artefakty publikowane na npm są
niedziałające dla zewnętrznego konsumenta** — pipeline budowania nigdy nie był
walidowany z jego perspektywy. Cztery klasy blokerów:

1. **F-C1 — uszkodzone `.d.ts` w 10/19 pakietów** (77 plików): importy
   `../../../di/src/index.ts` wskazują ścieżki monorepo nieistniejące w
   tarballu. Przyczyna: `packages/utils/build-configs/config-builders.ts:24-55`
   naprawia ścieżki tylko dla `isMetaPackage` (≥5 deps,
   `package-detection.ts:86-87`), tylko top-level `index.d.ts`, a regex nie
   łapie ≥3 poziomów `../`. Dotknięte: acl, aggregates, cqrs, events, messaging,
   nestjs, policies, projections, testing, validation.
2. **F-C2 — ESM dist `testing` niedziałający**: gołe
   `require("@vytches/ddd-value-objects")` w
   `dist/index.js:851,1450,1466,1484,1522` (źródło: lazy require w
   `seeder/entity-id-generator.ts` i `seeder/aggregate-factory.ts:452`) →
   `ReferenceError` w ESM.
3. **F-C3 — niezadeklarowany `reflect-metadata`** w cqrs, di, events,
   domain-services (bezwarunkowy load w 1. linii dist; deklaruje tylko nestjs).
4. **F-H1 — 18 fantomowych zależności workspace** w dist 10 pakietów (pełna
   lista file:line w analysis, Załącznik I) — instalacja pojedynczego pakietu na
   pnpm/yarn-pnp = `ERR_MODULE_NOT_FOUND`.

## Acceptance Criteria

1. [x] **Smoke test w CI** (najpierw — łapie wszystko poniżej): po `pnpm build`
       dla każdego pakietu `npm pack` → instalacja w izolowanym tmp
       (node-linker=isolated) → import ESM i CJS → `tsc --noEmit` na trywialnym
       konsumencie. Gate blokujący release. → `scripts/smoke-test-publish.sh`,
       wpięty w `ci.yml` + `release.yml`. 19/19 pakietów zielone, w tym
       `--ignore-scripts` na instalacjach.
2. [x] `.d.ts` bez ścieżek `*/src/index.ts`: `rollupTypes: true` dla wszystkich
       pakietów LUB rozszerzenie afterBuildTasks (bez gate'u isMetaPackage,
       rekurencyjnie po dist/\*_/_.d.ts, regex dla dowolnej głębokości `../`).
       Dodatkowy check CI: `grep -r "/src/index.ts" packages/*/dist` = pusto. →
       wybrano wariant B (bez `rollupTypes` — repo używa Vite + vite-plugin-dts,
       kolejność buildów niepotwierdzona). Skonsolidowano dwa niespójne fixery
       (`config-builders.ts` + `scripts/fix-dts-imports.js`) w jeden, bez
       gate'u, rekurencyjny, z dynamiczną listą pakietów.
3. [x] `reflect-metadata` zadeklarowany (peerDependency) w cqrs, di, events,
       domain-services; przemyśleć side-effect import vs sideEffects:false
       (dokumentacja wymogu importu przez konsumenta lub jawna deklaracja). →
       optional peerDependency + usunięty side-effect import, README w każdym z
       4 pakietów dokumentuje wymóg importu przez konsumenta.
4. [x] Wszystkie 18 fantomowych zależności workspace dodane do `dependencies`
       właściwych pakietów (lub import usunięty); weryfikacja skryptem
       porównującym importy w dist z manifestem. → wszystkie 18 dodane i
       zweryfikowane. Przy okazji znaleziono i naprawiono dodatkową, nieujętą w
       audycie fantomową zależność typu (`@vytches/ddd-di` w `cqrs` — realna
       zależność wymagana przez `CommandBus`/`QueryBus`, nie opcjonalny peer jak
       błędnie wdrożono w pierwszej iteracji poprawki).
5. [x] `testing`: lazy require zamieniony na dynamic import / createRequire —
       dist ESM działa; import bare `events` → `node:events`. →
       `createRequire(import.meta.url)` w entity-id-generator.ts /
       aggregate-factory.ts, `node:events` w streaming-seeder.ts.
6. [x] `utils`: `uuid` zastąpione `globalThis.crypto.randomUUID()` + walidacja
       bez zewnętrznej biblioteki (wzorzec:
       `contracts/src/events/domain-event-utils.ts:16`) — przywraca prawdziwe
       zero-deps i usuwa problem vendoringu (F-M7). → regex rozszerzony do RFC
       9562 (wersje 1-8 + nil/max UUID), zgodny z zachowaniem `uuid@11.x`
       używanym realnie przez `juz-ide-api`.
7. [x] LICENSE w `files` whitelist wszystkich 19 pakietów (kopiowany z roota
       przy buildzie) — F-M8.
8. [x] Root package.json: rename na `@vytches/ddd-workspace` (usuwa kolizję z
       enterprise), usunięcie stale publishConfig, wyrównanie/oznaczenie wersji
       (F-H6). UWAGA: wersje pakietów zarządza Lerna — nie edytować ręcznie
       wersji pakietów. → `private: true` był już ustawiony (niższe ryzyko niż
       zakładano). Wersje nietknięte (Lerna).
9. [x] Bump `vitest` do ≥4.1.0 (F-H15, critical advisory arbitrary-file-read
       przy test:ui). → `^4.1.0` we wszystkich 19 pakietach + `examples/*` +
       `benchmarks` (ten ostatni doprecyzowany dopiero w re-weryfikacji
       bezpieczeństwa). `grep vitest@4.0.18 pnpm-lock.yaml` = 0 wystąpień.
10. [x] Przy okazji fixu deps: przegląd inline-bundlingu klas foundation
        (bundle-all) pod kątem tożsamości instanceof między pakietami (F-M20) —
        minimum: udokumentowana decyzja. → udokumentowane w
        `packages/utils/build-configs/bundle-strategies.ts`: brak potwierdzonego
        ryzyka dziś, `bundle-all` używany tylko przez `utils`/`contracts` (zero
        cross-dependencies).

## Out of scope

- Zmiany powierzchni API (VF-024), poprawki funkcjonalne pakietów (VB-003,
  VF-023, VF-025).

## References

- Analysis: `project-orchestration/analysis/LIB-AUDIT-2026-07-02.analysis.md`
  (F-C1, F-C2, F-C3, F-H1, F-H6, F-H15, F-M7, F-M8, F-M20 + Załącznik I)

## Activity Log

| Date       | Agent                                     | Action                     | Result                                                                                                                                                                                                  |
| ---------- | ----------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-02 | LIB-AUDIT-2026-07-02                      | Finding detected           | 9 findings (F-C1, F-C2, F-C3, F-H1, F-H6, F-H15, F-M7, F-M8, F-M20)                                                                                                                                     |
| 2026-07-02 | library-api-guardian                      | Architecture modeling      | 5 decisions (fixer consolidation, reflect-metadata peer, F-M20 deferred, smoke-test design, root rename)                                                                                                |
| 2026-07-02 | general-purpose (implementer)             | Implementation             | All 10 AC implemented; build/typecheck/lint/2415 tests/smoke-test green (self-report)                                                                                                                   |
| 2026-07-02 | library-quality-verifier + security-audit | Verification round 1       | Quality: WARN (real bug: `@vytches/ddd-di` in cqrs undeclared as type dep, `--skipLibCheck` blind spot). Security: PASS + 2 MEDIUM (`--ignore-scripts`, residual vitest 4.0.18 in examples)             |
| 2026-07-02 | general-purpose (fix round 1)             | Fix WARN + MEDIUM findings | Fixed all 5 items; found + fixed 2 more real bugs (reflect-metadata phantom dep in `examples/domain-services`, UUID regex parity gap vs `uuid@11.x`). 2456 tests passing                                |
| 2026-07-02 | library-quality-verifier                  | Verification round 2       | **VETO** — `@vytches/ddd-di` mischaracterized as optional peerDependency in cqrs when actually required (contradicts package's own README); smoke-test workaround moved the goalposts                   |
| 2026-07-02 | general-purpose (fix round 2)             | Fix VETO                   | Reclassified `@vytches/ddd-di` as plain `dependencies`; simplified smoke-test-publish.sh (removed type-check-only install workaround). 2506 tests passing                                               |
| 2026-07-02 | general-purpose (fix round 3)             | Fix residual MEDIUM        | Bumped `benchmarks/package.json` vitest to `^4.1.0`; `vitest@4.0.18` fully gone from lockfile                                                                                                           |
| 2026-07-02 | library-quality-verifier + security-audit | Final verification         | Both **PASS**. Definitive clean repro confirmed prior VETO-adjacent failure was a repro methodology error (wrong export name), not a real bug — `tsc` 0 errors, smoke-test 19/19, `pnpm test` 2506/2506 |
| 2026-07-02 | claude                                    | Commit + merge             | commit `82d92fdc` on `refactor/VB-002-publish-integrity-pipeline`, merged to `develop` via `130e72b1`                                                                                                   |

---

_Task managed by /orchestrate (typescript-library stack) | Source audit:
LIB-AUDIT-2026-07-02 | Resolved 2026-07-02_
