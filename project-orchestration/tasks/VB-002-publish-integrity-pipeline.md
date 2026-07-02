# Task: Publish Integrity Pipeline — naprawa buildu/packagingu + smoke test w CI

## Task Metadata

```yaml
task_id: VB-002
title: Fix broken published artifacts (.d.ts, ESM, deps) + consumer smoke test in CI
type: bug
priority: critical
complexity: complex
estimated_time: 16h
created_by: LIB-AUDIT-2026-07-02
created_at: 2026-07-02
status: backlog
release_target: pre-first-public-publish (blocks any npm publish)
package: build-configs (utils), testing, cqrs, di, events, domain-services, all 19 manifests
findings: [F-C1, F-C2, F-C3, F-H1, F-H6, F-H15, F-M7, F-M8, F-M20]
```

## Dlaczego

Audyt LIB-AUDIT-2026-07-02 wykazał, że **artefakty publikowane na npm są
niedziałające dla zewnętrznego konsumenta** — pipeline budowania nigdy nie był
walidowany z jego perspektywy. Cztery klasy blokerów:

1. **F-C1 — uszkodzone `.d.ts` w 10/19 pakietów** (77 plików): importy
   `../../../di/src/index.ts` wskazują ścieżki monorepo nieistniejące
   w tarballu. Przyczyna: `packages/utils/build-configs/config-builders.ts:24-55`
   naprawia ścieżki tylko dla `isMetaPackage` (≥5 deps,
   `package-detection.ts:86-87`), tylko top-level `index.d.ts`, a regex nie
   łapie ≥3 poziomów `../`. Dotknięte: acl, aggregates, cqrs, events,
   messaging, nestjs, policies, projections, testing, validation.
2. **F-C2 — ESM dist `testing` niedziałający**: gołe
   `require("@vytches/ddd-value-objects")` w `dist/index.js:851,1450,1466,1484,1522`
   (źródło: lazy require w `seeder/entity-id-generator.ts` i
   `seeder/aggregate-factory.ts:452`) → `ReferenceError` w ESM.
3. **F-C3 — niezadeklarowany `reflect-metadata`** w cqrs, di, events,
   domain-services (bezwarunkowy load w 1. linii dist; deklaruje tylko nestjs).
4. **F-H1 — 18 fantomowych zależności workspace** w dist 10 pakietów (pełna
   lista file:line w analysis, Załącznik I) — instalacja pojedynczego pakietu
   na pnpm/yarn-pnp = `ERR_MODULE_NOT_FOUND`.

## Acceptance Criteria

1. [ ] **Smoke test w CI** (najpierw — łapie wszystko poniżej): po `pnpm build`
       dla każdego pakietu `npm pack` → instalacja w izolowanym tmp
       (node-linker=isolated) → import ESM i CJS → `tsc --noEmit` na trywialnym
       konsumencie. Gate blokujący release.
2. [ ] `.d.ts` bez ścieżek `*/src/index.ts`: `rollupTypes: true` dla wszystkich
       pakietów LUB rozszerzenie afterBuildTasks (bez gate'u isMetaPackage,
       rekurencyjnie po dist/**/*.d.ts, regex dla dowolnej głębokości `../`).
       Dodatkowy check CI: `grep -r "/src/index.ts" packages/*/dist` = pusto.
3. [ ] `reflect-metadata` zadeklarowany (peerDependency) w cqrs, di, events,
       domain-services; przemyśleć side-effect import vs sideEffects:false
       (dokumentacja wymogu importu przez konsumenta lub jawna deklaracja).
4. [ ] Wszystkie 18 fantomowych zależności workspace dodane do `dependencies`
       właściwych pakietów (lub import usunięty); weryfikacja skryptem
       porównującym importy w dist z manifestem.
5. [ ] `testing`: lazy require zamieniony na dynamic import / createRequire —
       dist ESM działa; import bare `events` → `node:events`.
6. [ ] `utils`: `uuid` zastąpione `globalThis.crypto.randomUUID()` +
       walidacja bez zewnętrznej biblioteki (wzorzec:
       `contracts/src/events/domain-event-utils.ts:16`) — przywraca prawdziwe
       zero-deps i usuwa problem vendoringu (F-M7).
7. [ ] LICENSE w `files` whitelist wszystkich 19 pakietów (kopiowany z roota
       przy buildzie) — F-M8.
8. [ ] Root package.json: rename na `@vytches/ddd-workspace` (usuwa kolizję
       z enterprise), usunięcie stale publishConfig, wyrównanie/oznaczenie
       wersji (F-H6). UWAGA: wersje pakietów zarządza Lerna — nie edytować
       ręcznie wersji pakietów.
9. [ ] Bump `vitest` do ≥4.1.0 (F-H15, critical advisory arbitrary-file-read
       przy test:ui).
10. [ ] Przy okazji fixu deps: przegląd inline-bundlingu klas foundation
        (bundle-all) pod kątem tożsamości instanceof między pakietami (F-M20)
        — minimum: udokumentowana decyzja.

## Out of scope

- Zmiany powierzchni API (VF-024), poprawki funkcjonalne pakietów (VB-003,
  VF-023, VF-025).

## References

- Analysis: `project-orchestration/analysis/LIB-AUDIT-2026-07-02.analysis.md`
  (F-C1, F-C2, F-C3, F-H1, F-H6, F-H15, F-M7, F-M8, F-M20 + Załącznik I)
