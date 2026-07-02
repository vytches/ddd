# Task: NestJS forFeature — naprawa okablowania DI izolacji kontekstów

## Task Metadata

```yaml
task_id: VB-003
title: forFeature() ModulesContainer fix + forRootAsync + module API cleanup
type: bug
priority: critical
complexity: medium
estimated_time: 8h
created_by: LIB-AUDIT-2026-07-02
created_at: 2026-07-02
status: backlog
release_target: pre-first-public-publish
package: '@vytches/nestjs'
findings: [F-C4, F-H8, F-M5, F-M15, F-M19]
```

## Dlaczego

**F-C4 (CRITICAL, zweryfikowane empirycznie na @nestjs/core@11.1.19):**
`vytches-ddd-feature.module.ts:75` umieszcza `ModulesContainer` w `providers`,
przez co NestJS tworzy świeżą, PUSTĄ mapę zamiast wstrzyknąć realny kontener
z InternalCoreModule (probe: size=0 z lokalnym providerem vs size=3 bez).
Łańcuch skutków:

- `FeatureHandlerRegistrar.findOwnModule()` (feature-handler-registrar.ts:108-134)
  iteruje zero modułów → `onModuleInit` (62-67) loguje warn i **pomija lokalną
  rejestrację**;
- handlery nie są "claimowane" → globalny explorer rejestruje je na globalnych
  busach — regresja dokładnie tego buga, który forFeature miał naprawić
  (ADR-0034);
- `ContextAwareEventDispatcher` (context-aware-event-dispatcher.ts:86-96)
  nadal kieruje zdarzenia domenowe do LOCAL_EVENT_BUS, **na którym nikt nie
  słucha**.

Testy tego nie łapią: `tests/feature/feature-handler-registrar.test.ts:57-80`
mockuje kontener ręcznie; `global-bus-acl.test.ts` nie woła `.init()`.

Fix zasadniczy to JEDNA LINIA (usunięcie ModulesContainer z providers —
jest globalnie injectable), ale task obejmuje też realny test e2e i naprawę
pozostałych zepsutych obietnic API modułu.

## Acceptance Criteria

1. [ ] `ModulesContainer` usunięty z providers forFeature; lokalna rejestracja
       działa (handlery claimowane, LOCAL_EVENT_BUS ma słuchaczy).
2. [ ] Test e2e z prawdziwym `Test.createTestingModule(...).compile()` +
       `app.init()` asertujący: (a) decorated handler ląduje na lokalnym busie,
       (b) zdarzenie domenowe dociera do handlera przez lokalny bus,
       (c) handler NIE jest zarejestrowany na globalnym busie.
3. [ ] `forRootAsync()` faktycznie konsumuje `useFactory`/`inject`
       (vytches-ddd.module.ts:105-139) — albo jest usunięte z API przed
       publikacją (decyzja; F-H8).
4. [ ] `strictHandlerRegistration` osiągalne z `forContext()`/`forContexts()` —
       fabryki wołają `configureContext()` (obecnie `_contextOptions`
       write-only; F-M5).
5. [ ] Guard przed podwójną rejestracją handlerów zdarzeń przy wielu
       instancjach explorera (forRoot + forContext; F-M5).
6. [ ] Cleanup: `AutoDiscoveryService` (publiczny no-op) usunięty lub
       naprawiony; 6 martwych pól deprecated w types.ts:92-147 usuniętych;
       `contexts` od-deprecated lub poprawnie przekierowane (F-M15).
7. [ ] Deep import `@nestjs/core/injector/modules-container.js` zastąpiony
       publicznym importem z `@nestjs/core` (F-M19).
8. [ ] Regresja: istniejące testy nestjs zielone; walidacja na juz-ide-api
       jeśli używa forFeature (skoordynować z VS-013).

## Out of scope

- Wydajność adaptera kontenera — VP-006b (osobny task, potwierdzone linie
  w F-H12).

## References

- Analysis: `project-orchestration/analysis/LIB-AUDIT-2026-07-02.analysis.md`
  (F-C4, F-H8, F-M5, F-M15, F-M19 + Załącznik J)
- ADR-0034 (cross-context handler leakage — historia problemu)
