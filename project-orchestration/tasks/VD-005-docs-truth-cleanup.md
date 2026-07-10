# Task: Dokumentacja — usunięcie fikcji i uzgodnienie z kodem

## Task Metadata

```yaml
task_id: VD-005
title:
  docs/README rewrite, abandoned roadmaps, ADR index, quickstart reconciliation,
  AggregateRoot JSDoc
type: documentation
priority: normal
complexity: simple
estimated_time: 12h
created_by: LIB-AUDIT-2026-07-02
created_at: 2026-07-02
status: backlog
release_target: pre-first-public-publish (wizerunkowo istotne)
package: docs/, packages/aggregates
findings: [F-H16, F-M11, F-M12, F-M17, JSDoc gaps, UX-T3]
```

## Dlaczego

Ścieżka README → QUICK_START jest zweryfikowana i działa (10–15 min TTFS), ale
**wejście przez docs/ to time-to-frustration <2 min**:

1. **F-H16:** `docs/README.md` jest w >80% fikcyjny — "23 pakiety" (jest 19),
   nieistniejące pakiety event-store/logging, martwe komendy
   (`pnpm cli examples generate`, `pnpm jsdoc:publish`), nieistniejące
   `docs/api/`. `docs/JSDOC_EXAMPLES_ROADMAP.md` twierdzi "YAML-ONLY SYSTEM
   OPERATIONAL" — na dysku 0 plików YAML, brak vite-pluginu, a JSDoc jest inline
   (dokładnie to, co doc uznaje za "wyeliminowane"). Mylące też dla asystentów
   AI czytających kontekst repo.
2. **F-M11:** indeks `docs/adr/README.md` kończy się na 0019 — 18 ADR-ów
   (0020–0037) niewidocznych; martwe scope-tagi w `.eslintrc.json` (core,
   logging, cli, event-store, event-scheduling, process-managers, examples —
   linie 88-298).
3. **F-M12:** dwa quickstarty modelują SPRZECZNE konwencje błędów w tym samym
   przykładzie Order (README: `Result<T,E>`; QUICK_START: `throw` w logice
   domenowej) — pierwsze dwa code-sample nowego dewelopera przeczą sobie
   nawzajem.
4. **JSDoc na flagowej klasie:** metody `getVersion`, `getInitialVersion`,
   `hasChanges`, `getDomainEvents` mają puste opisy (aggregate-root.ts:147+);
   `apply()` — najważniejsza metoda, która rzuca — bez `@throws` i method-level
   `@example`.

## Acceptance Criteria

1. [ ] `docs/README.md` przepisany z realnego stanu (19 pakietów, realne skrypty
       z package.json) LUB usunięty z przekierowaniem do README/QUICK_START.
2. [ ] `JSDOC_EXAMPLES_ROADMAP.md` + `YAML_ONLY_CLEANUP_STATUS.md` + pokrewne
       plany oznaczone `status: abandoned/superseded` (nagłówek) lub
       przeniesione do docs/archive/.
3. [ ] Indeks ADR zregenerowany (0001–0037); rozważyć skrypt generujący.
4. [ ] Martwe scope-tagi usunięte z `.eslintrc.json`.
5. [ ] Quickstarty uzgodnione: jeden kształt `Order`, jedna konwencja błędów
       (Result<T,E> — zgodnie z design decision biblioteki) albo jawne
       wyjaśnienie, kiedy throw jest OK.
6. [ ] JSDoc na metodach publicznych AggregateRoot uzupełnione (@throws na
       apply, opisy getterów, method-level @example).
7. [ ] Krótki przewodnik "Specification vs Policy — czego użyć kiedy" (F-M17) w
       docs/guides/.
8. [ ] Sekcja logging w SECURITY-AUDIT-2026-05-26.md oznaczona jako
       historyczna/superseded (pakiet usunięty w VS-013).
9. [ ] Regeneracja CLAUDE.md (`generate-claude-md.sh`) — usunięcie nieaktualnej
       wersji/opisu.
10. [ ] **UX-T3 (LIB-UX-AUDIT-2026-07-10) — niekompilujące się snippety
        first-contact:** (a) `packages/events/README.md:74,112` — zła kolejność
        argumentów konstruktora (`super('Name', payload, meta)` vs realne
        payload-first — copy-paste działa, ale cicho źle); (b)
        `packages/validation/README.md:44,106-109` — nieistniejąca metoda
        `.must()` (poprawne API `.addRule()` jest w LLMGUIDE); (c)
        `packages/resilience/LLMGUIDE.md:35-40,126-139` — 4 zepsute snippety
        (`baseDelayMs`→`baseDelay`+wymagane pola,
        `maxConcurrent/maxQueue`→`maxConcurrency/queueCapacity`,
        `timeout:{ms}`→number, obietnica metryk per-metoda których nie ma); (d)
        `packages/nestjs/README_SIMPLE_INTEGRATION.md:30` — nieistniejąca opcja
        `autoRegister` (koordynacja z VF-032 AC6); (e)
        `packages/validation/LLMGUIDE.md:358` — zależność od nieistniejącego
        `@vytches/ddd-logging`.
11. [ ] **Gate kompilacji docs:** CI check type-checkujący code-fences w
        README/LLMGUIDE (rozszerzenie mechanizmu VD-006a) — żeby klasa driftu z
        AC10 nie wracała.

## References

- Analysis: `project-orchestration/analysis/LIB-AUDIT-2026-07-02.analysis.md`
  (F-H16, F-M11, F-M12, F-M17 + Załącznik F)
- `docs/quickstart-validation-friction-log.md` — istniejący proces, do którego
  ten task dokłada obszar docs/
