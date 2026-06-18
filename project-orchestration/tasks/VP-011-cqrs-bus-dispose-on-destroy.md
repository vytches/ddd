# Task: nestjs: call dispose() on buses in onModuleDestroy to prevent timer leaks

## Task Metadata

```yaml
task_id: VP-011
title:
  'nestjs: call dispose() on buses in onModuleDestroy to prevent timer leaks'
type: improvement
priority: low
complexity: low
estimated_time: 2h
created_by: agent
created_at: 2026-06-11
updated_at: 2026-06-18
status: review
related:
  VP-010 (bus lifecycle guardrails — unref, enableCache, IDisposableBus export)
memory_ref: consumer_juz_ide_api
```

## Domain Context

```yaml
bounded_context: NestJS Integration / CQRS infrastructure
patterns:
  - Bus lifecycle (onModuleDestroy → reset + dispose)
  - Resource cleanup (setInterval / timers)
  - Duck-typed capability check (IDisposableBus)
```

## Business Context

### Why This Task Exists

Wykryte podczas weryfikacji VP-010 przez `library-quality-verifier`.

`VytchesExplorerService.onModuleDestroy()` woła `reset()` na busach, ale NIE
woła `dispose()`. Busy implementujące `IDisposableBus`
(`EnhancedCommandBus`/`EnhancedQueryBus`, kontrakt eksportowany w VP-010 #5)
posiadają timery cache-cleanup (setInterval).

Mimo że VP-010 #1 dodało `.unref()` (timer nie blokuje event-loop procesu),
aktywny interval nadal istnieje w pamięci aż do GC. Przy wielu cyklach
create→destroy w jednym procesie (np. testy E2E w jednym vitest-workerze) może
akumulować uchwyty — każda nowa instancja app tworzy nowe timery, a stare nie są
jawnie czyszczone.

`dispose()` jawnie czyści te timery (`clearInterval`) i jest uzupełnieniem
`reset()` (które czyści handlery/stan, ale nie zatrzymuje timerów).

## Requirements & Acceptance Criteria

### Scope

- [x] **#1 (P0) woła dispose() w onModuleDestroy** — w
      `VytchesExplorerService.onModuleDestroy()`, dla każdego busa który
      implementuje `IDisposableBus` (duck-type: `typeof lifecycle.dispose ===
      'function'`), wywołać `dispose()` po `reset()`. Tolerancja błędów:
      `try/catch` + `internalLogger.warn` analogicznie do obsługi `reset()`.
      `BusWithRegistration` rozszerzony o opcjonalne `dispose?()`.
- [x] **#2 test** — `tests/explorer-dispose-on-destroy.test.ts`, 6 przypadków:
      dispose po reset (kolejność), wszystkie 3 busy, graceful skip bez
      `dispose()`, dispose mimo rzucającego `reset()`, brak crashu gdy
      `dispose()` rzuca, no-op bez busów. 210/210 testów nestjs zielone.

### Non-Functional

- [ ] Backward-compat: zmiana addytywna — bussy bez `dispose()` nie są
      dotknięte; konsumenci używający własnych implementacji `IResettableBus`
      bez `dispose()` działają bez zmian.
- [ ] Logowanie: wyłącznie `internalLogger` (per VS-013 — brak warstwy
      app-logging).
- [ ] `IDisposableBus` musi być wyeksportowany z `@vytches/ddd-cqrs` zanim ten
      task zostanie zaimplementowany (zależność od VP-010 #5).

## Code References

```yaml
packages:
  - package: '@vytches/ddd-nestjs'
    files:
      - src/services/vytches-explorer.service.ts # onModuleDestroy (~:133) — dodać dispose()
      - tests/ # nowy test: dispose() wywołane przy destroy
  - package: '@vytches/ddd-cqrs'
    files:
      - src/index.ts # IDisposableBus export (VP-010 #5 — prereq)
      - src/implementations/enhanced-command-bus.ts # implementuje dispose()
      - src/implementations/enhanced-query-bus.ts # implementuje dispose()
```

## Risk Assessment

| Risk                                                                | Probability | Impact | Mitigation                                                             |
| ------------------------------------------------------------------- | ----------- | ------ | ---------------------------------------------------------------------- |
| dispose() rzuca dla busa w nieoczekiwanym stanie                    | Low         | Low    | try/catch + internalLogger.warn (analogicznie do reset())              |
| IDisposableBus nie wyeksportowany gdy task wdrażany przed VP-010 #5 | Medium      | High   | Zablokować PR do czasu merge VP-010; duck-type fallback jako backup    |
| Podwójne czyszczenie (reset + dispose w złej kolejności)            | Low         | Low    | dispose() po reset(); kolejność: reset czyści stan, dispose czyści I/O |

## Links & References

- VP-010 — prereq: `IDisposableBus` export (#5), `unref()` na timerach (#1)
- `VytchesExplorerService.onModuleDestroy()` — `vytches-explorer.service.ts:133`
- VS-013 — logging policy: tylko `internalLogger` w bibliotece (zmergowany)

## Final Notes

Task addytywny — nie zmienia żadnego publicznego API. Może być wdrożony w tym
samym PR co VP-010 lub jako osobny, drobny follow-up. Priorytet `low`: `unref()`
z VP-010 #1 eliminuje blokowanie event-loop; ten task jest hygieną zasobów.

---

_Task managed by Project Orchestrator | Last AI Review: 2026-06-11_
