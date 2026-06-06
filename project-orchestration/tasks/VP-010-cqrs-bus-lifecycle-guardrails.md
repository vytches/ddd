# Task: CQRS bus lifecycle guardrails — timer leaks + stale-factory footgun

## Task Metadata

```yaml
task_id: VP-010
title: "nestjs/cqrs: bus lifecycle guardrails — unref timers, enableCache symmetry, stale-factory signal, dispose export"
type: improvement
priority: medium
complexity: medium
estimated_time: 6h
created_by: agent
created_at: 2026-06-06
status: planned
related: VP-009 (per-context CQRS bus — distinct: registration/tokens, not lifecycle)
memory_ref: consumer_juz_ide_api
```

## Domain Context

```yaml
bounded_context: NestJS Integration / CQRS infrastructure
patterns:
  - Bus lifecycle (onModuleDestroy → reset)
  - Resource cleanup (setInterval / timers)
  - Fail-loud guardrails
```

## Business Context

### Why This Task Exists

Konsument `juz-ide-api` zgłosił 503 (`SessionValidationGuard` →
`queryBus.execute(ValidateSessionQuery)` rzuca) w testach E2E przy recreacji
aplikacji w tym samym vitest-worker-procesie: stale handler factories wskazujące
na nieważny `moduleRef` poprzedniej instancji app.

**Werdykt (5 agentów + weryfikacja kodu biblioteki 2026-06-06):** root-cause to
**mis-config konsumenta**, NIE bug biblioteki:

- Bieżące źródło JUŻ ma lifecycle-fix:
  `VytchesExplorerService.onModuleDestroy()` woła `bus.reset()`
  (`vytches-explorer.service.ts:133-142`), `forFeature()` używa `useFactory`
  (`vytches-ddd-feature.module.ts:59,66,72`), JSDoc ostrzega przed `useValue`.
- Feedback konsumenta cytuje
  `node_modules/@vytches/ddd-nestjs/dist/index.cjs:67`
  (`if (this.initialized) return`) — czyli **starą opublikowaną wersję** sprzed
  fixu.
- Kruchy warunek pozostały: `reset()` odpala się tylko gdy bus jest pod tokenem
  `IQueryBus`/`ICommandBus` i implementuje `IResettableBus`. Konsument
  rejestruje `EnhancedQueryBus` jako `useValue` (potencjalnie pod własnym
  tokenem) → `VytchesExplorerService.queryBus` undefined → `reset()` nigdy →
  stale → 503.

Ten task = **guardraile biblioteki**, by ten footgun nie wracał cicho. Naprawa
samego 503 należy do konsumenta (patrz niżej).

### Consumer-side (juz-ide-api — NIE w tym repo, guidance do MIGRATION)

1. Upgrade `@vytches/ddd` do wersji z lifecycle-fix (bieżący develop).
2. `useValue` → `useFactory` pod kanonicznymi `IQueryBus`/`ICommandBus` (lub
   `VytchesDDDModule.forFeature(ctx)`).
3. 5 subscription E2E + geo-guardrails = konsument (commit `088e47f8c` zmienił
   include-pattern; geo to kaskada tego samego 503) — nie regresja biblioteki.

## Requirements & Acceptance Criteria — guardraile (ROI-sorted)

### Potwierdzone jako NIEzrobione (weryfikacja 2026-06-06)

- [ ] **#1 (P0) unref() na timerach cache-cleanup** —
      `enhanced-command-bus.ts:154,283` i `enhanced-query-bus.ts:270` robią
      `setInterval(...)` BEZ `.unref()`. Setki instancji busów w jednym
      vitest-workerze trzymają event-loop → timeouty/„503". `unref()` pozwala
      workerowi się zamknąć.
- [ ] **#2 enableCache symmetry** — `enhanced-command-bus.ts:139` `?? true` vs
      `enhanced-query-bus.ts:236` `?? false`. Wyrównać command → `false`
      (eliminuje timer w testach). Behawioralna → CHANGELOG/MIGRATION.
- [ ] **#5 eksport IDisposableBus / dispose** — `IResettableBus` jest w
      `cqrs/src/index.ts:7`, ale `dispose()` jest ukryte (duck-typing w 2
      miejscach). Wyeksportować publiczny kontrakt `dispose`.

### Do zaprojektowania

- [ ] **#3 runtime warning** w `VytchesExplorerService.onModuleInit` gdy
      wstrzyknięty bus NIE implementuje `IResettableBus` (przeżyje destroy ze
      stale factories) — zamienia cichą pułapkę w czytelny sygnał.
- [ ] **#4 lepszy błąd** przy nieudanej resolucji handlera (hint „handler exists
      but may be stale — bus reused across module lifecycles") zamiast głuchego
      rzutu → 503.
- [ ] **#6 regression E2E** — sekwencja create→destroy→create test-app w jednym
      procesie; asercja że druga app używa świeżych handlerów.
- [ ] **#7 (low) base CommandBus/QueryBus reset()** — dziś brak; niski
      priorytet, bo `forFeature` używa ich z `useFactory` (świeża instancja per
      moduł).

### Non-Functional

- [ ] Backward-compat: #1/#3/#4/#6 addytywne; #2/#5 zmiana zachowania/API →
      MINOR + MIGRATION.md
- [ ] Testy: timer cleanup (unref nie blokuje workera), warning path, regression
      E2E
- [ ] library-api-guardian: potwierdzenie semver (MINOR)

## Code References

```yaml
packages:
  - package: '@vytches/ddd-cqrs'
    files:
      - src/implementations/enhanced-command-bus.ts # #1 unref (154,283), #2 enableCache (139)
      - src/implementations/enhanced-query-bus.ts # #1 unref (270), #2 (236)
      - src/index.ts # #5 export dispose/IDisposableBus (IResettableBus @ :7)
      - src/abstracts/command-bus.abstract.ts # #7 base reset (low)
      - src/abstracts/query-bus.abstract.ts # #7 base reset (low)
  - package: '@vytches/ddd-nestjs'
    files:
      - src/services/vytches-explorer.service.ts # #3 warning, #4 better error (onModuleInit; reset @ :133)
      - tests/ # #6 regression: create→destroy→create
```

## Risk Assessment

| Risk                                                                           | Probability | Impact | Mitigation                                                                                |
| ------------------------------------------------------------------------------ | ----------- | ------ | ----------------------------------------------------------------------------------------- |
| #2 enableCache default change surprises consumers relying on command-bus cache | Low         | Med    | MIGRATION.md note; opt-in via enableCache(true)                                           |
| unref() masks a real never-closing handle elsewhere                            | Low         | Low    | scoped only to cache-cleanup interval                                                     |
| 503 perceived as library bug                                                   | —           | Med    | This task documents it as consumer mis-config + old version; library adds guardrails only |

## Links & References

- VP-009 — per-context CQRS bus (sibling; registration/tokens/dual-package, NOT
  lifecycle)
- Source already-fixed: `vytches-explorer.service.ts:133`
  (onModuleDestroy→reset), `vytches-ddd-feature.module.ts:59-72` (useFactory)
- Consumer feedback referenced old `dist/index.cjs:67` (pre-fix published
  version)
- ADR-0034 (per-context CQRS bus isolation)

## Final Notes

Skonsolidowane z analizy 5 agentów w innym kontekście (architecture-guardian,
library-api-guardian, library-expert, performance-optimizer, tech-lead) +
weryfikacja kodu 2026-06-06. Sugestia z tamtej rozmowy „wdrożyć na branchu
VS-009" jest NIEAKTUALNA — VS-009 anulowany (był o loggingu → VS-013,
zmergowany). Guardraile należą tu, w dedykowanym tasku nestjs/cqrs. Root-cause
503 = konsument; biblioteka dostarcza fail-loud guardraile, żeby footgun nie
wracał.

---

_Task managed by Project Orchestrator | Last AI Review: 2026-06-06_
