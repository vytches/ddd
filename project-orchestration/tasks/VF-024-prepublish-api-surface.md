# Task: Powierzchnia publicznego API przed pierwszą publikacją

## Task Metadata

```yaml
task_id: VF-024
title: Enterprise barrel curation, name collisions, deprecated removals, internal symbols
type: refactor
priority: high
complexity: medium
estimated_time: 10h
created_by: LIB-AUDIT-2026-07-02
created_at: 2026-07-02
status: backlog
release_target: pre-first-public-publish (BC window)
package: '@vytches/ddd' (enterprise), contracts, value-objects, di, domain-services, nestjs, testing
findings: [F-C7, F-H17, F-M14, F-M15(część), LOW: BaseEntityId, testing wildcard]
```

## Dlaczego

Pierwsza publiczna publikacja to jedyny moment, w którym te zmiany są tanie.
Po niej każda staje się breaking change z pełnym cyklem deprecacji.

1. **F-C7:** `enterprise/src/index.ts` — faktyczny pakiet `@vytches/ddd` —
   ma 10× `export *` (linie 101, 108, 109, 112, 113, 114, 177, 180, 181,
   208) wbrew własnej polityce REL-005, którą wszystkie liście już wdrożyły.
   Każdy nowy eksport w 10 pakietach staje się publicznym API bez review.
   Snapshot `enterprise/tests/api-surface.test.ts` (~226 nazw) łapie tylko
   NAZWY (nie sygnatury) i w CI per-PR leci tylko affected.
2. **F-C7b:** kolizja `ServiceNotFoundError` (di/src/index.ts:29-37 vs
   domain-services) "rozwiązana" przez pominięcie w liście eksportów di
   (enterprise:221-241) — pułapka instanceof, krucha przy regeneracji barreli.
3. **F-H17:** `EntityIdFactory` (deprecated, z runtime warn) poleci w PIERWSZYM
   publicznym wydaniu — pre-1.0 to okno na usunięcie zamiast deprecacji.
4. **F-M14:** `internalLogger` eksportowany z barrela contracts mimo
   `@internal`; `EVENT_HANDLER_METADATA`/`EVENT_HANDLER_OPTIONS` (contracts)
   i `CUSTOM_MIDDLEWARE_SYMBOL` (events) publiczne w pakietach-liściach.

## Acceptance Criteria

1. [ ] 10 `export *` w enterprise/src/index.ts zamienione na jawne listy
       named exports (kuracja jak dla contracts/events/cqrs/di w tym samym
       pliku); snapshot api-surface enterprise zaktualizowany świadomie
       (diff review — okazja do wycięcia przypadkowych eksportów).
2. [ ] `ServiceNotFoundError` — rename jednej z klas
       (`ContainerServiceNotFoundError` vs `DomainServiceNotFoundError`);
       kolizja przestaje być load-bearing.
3. [ ] `EntityIdFactory` usunięte (decyzja: usunięcie pre-1.0 zamiast
       shipowania deprecated na day one) wraz z runtime-warnem i env-flagą;
       migracja w CHANGELOG.
4. [ ] `internalLogger` poza barrelem contracts (subpath
       `@vytches/ddd-contracts/internal` lub bezpośrednie importy plikowe
       między pakietami @vytches).
5. [ ] `BaseEntityId` alias → `ContractsEntityId` (spójnie
       z ContractsValidationError); enterprise:96.
6. [ ] `testing/src/index.ts:29` `export * from './seeder'` → jawna lista
       (seeder/index.ts już jest skurowany — VP-005).
7. [ ] Rozszerzenie testu api-surface o wykrywanie zmian SYGNATUR dla
       enterprise (api-extractor przestaje być advisory dla enterprise —
       usunąć `|| true` przynajmniej dla tego pakietu) — decyzja i wdrożenie.
8. [ ] Pełny BC assessment (library-api-guardian) + aktualizacja LLMGUIDE
       tam, gdzie zniknęły symbole.

## Out of scope

- Martwe pola deprecated w nestjs types.ts — VB-003 (robione razem z fixem
  modułu).
- Metryki resilience (wire-or-remove) — VF-025.
- Wersjonowanie: Lerna — bez ręcznych bumpów.

## References

- Analysis: `project-orchestration/analysis/LIB-AUDIT-2026-07-02.analysis.md`
  (F-C7, F-H17, F-M14 + Załącznik H)
- REL-005 (completed) — wzorzec kuracji barreli w liściach
