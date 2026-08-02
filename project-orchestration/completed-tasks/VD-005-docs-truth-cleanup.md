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
status: done
completed_at: 2026-07-13
release_target: pre-first-public-publish (wizerunkowo istotne)
package: docs/, packages/aggregates
findings: [F-H16, F-M11, F-M12, F-M17, JSDoc gaps, UX-T3]
```

## Completion Note (2026-07-13)

Implemented via `/analyze-ddd` → `/orchestrate-ddd` on
`feature/VD-005-docs-truth-cleanup` (approved analysis:
`project-orchestration/analysis/VD-005.analysis.md`, all 6 open questions
answered — human explicitly chose NOT to split into VD-005a/VD-005b despite both
panel agents recommending it, since release timing was not a constraint).
4-layer workflow (Docs Content → Config Cleanup → Code & Snippets → Compile
Gate), all GO, final consolidation gate GO.

Independently re-verified after the workflow (not just trusting its
self-reported GO): `pnpm nx affected --target=type-check` 22/22 projects,
`pnpm nx affected --target=test` 25/25 projects, then a full `pnpm build`
(exit 0) and full `pnpm test` (all 25 test-bearing projects green) run
separately before merge. New `tools/docs-compile-gate` package verified
directly: 29/29 tests passing, including a fixture with a deliberately-broken
marked fence proving the gate actually fails (not a rubber-stamp). Spot-checked
real file content (not just the workflow's claims) for every AC10 sub-item.

One decision worth recording: `.claude/config/project.yml` was also corrected
(package count "21"→"19", `integrations` skill category added) as a root-cause
fix for AC9 — `generate-claude-md.sh` only reads project.yml, so fixing just the
generated `CLAUDE.md` would have regressed on the next regeneration.

## Acceptance Criteria

1. [x] `docs/README.md` przepisany z realnego stanu (19 pakietów, realne skrypty
       z package.json) LUB usunięty z przekierowaniem do README/QUICK_START.
       Done: zastąpiony krótkim indeksem nawigacyjnym (README/QUICK_START/
       QUICK_START_NESTJS + spis zawartości docs/).
2. [x] `JSDOC_EXAMPLES_ROADMAP.md` + `YAML_ONLY_CLEANUP_STATUS.md` + pokrewne
       plany oznaczone `status: abandoned/superseded` (nagłówek) lub
       przeniesione do docs/archive/. Done: przeniesione do `docs/archive/`
       (razem z `enhanced-metadata-system-rollout-plan.md`, znalezionym przy
       okazji).
3. [x] Indeks ADR zregenerowany (0001–0037); rozważyć skrypt generujący. Done:
       `pnpm adr:generate` (istniejące `npx madr generate`) zadziałało wprost —
       `docs/adr/README.md` teraz obejmuje 0001–0038.
4. [x] Martwe scope-tagi usunięte z `.eslintrc.json`. Done: `scope:logging`
       (pakiet usunięty w VS-013) i inne martwe tagi usunięte.
5. [x] Quickstarty uzgodnione: jeden kształt `Order`, jedna konwencja błędów
       (Result<T,E> — zgodnie z design decision biblioteki) albo jawne
       wyjaśnienie, kiedy throw jest OK. Done: oba `README.md`/`QUICK_START.md`
       używają `Result<T,E>`; źródło konwencji zacytowane z
       `VF-017-result-pattern-standardization.md` (nie istnieje dedykowany ADR).
6. [x] JSDoc na metodach publicznych AggregateRoot uzupełnione (@throws na
       apply, opisy getterów, method-level @example). Done: `getVersion`/
       `getInitialVersion`/`hasChanges` mają prozę; `apply()` ma `@throws` +
       runnable `@example` demonstrujący guard `maxEvents`.
7. [x] Krótki przewodnik "Specification vs Policy — czego użyć kiedy" (F-M17) w
       docs/guides/. Done: `docs/guides/specification-vs-policy.md`.
8. [x] Sekcja logging w SECURITY-AUDIT-2026-05-26.md oznaczona jako
       historyczna/superseded (pakiet usunięty w VS-013). Done.
9. [x] Regeneracja CLAUDE.md (`generate-claude-md.sh`) — usunięcie nieaktualnej
       wersji/opisu. Done — przy okazji poprawione źródło (`project.yml`), nie
       tylko wygenerowany artefakt.
10. [x] **UX-T3 (LIB-UX-AUDIT-2026-07-10) — niekompilujące się snippety
        first-contact:** wszystkie 5 sub-punktów (a-e) zweryfikowane wobec
        realnego kodu źródłowego i naprawione: (a) events/README.md
        payload-first `super()`; (b) validation/README.md `.must()` →
        `addRule()`; (c) resilience/LLMGUIDE.md realne nazwy pól
        (`baseDelay`/`maxConcurrency`/`queueCapacity`); (d)
        nestjs/README_SIMPLE_INTEGRATION.md `autoRegister` usunięty + nota w
        `VF-032` AC6 (kolizja rozstrzygnięta na rzecz VD-005); (e)
        validation/LLMGUIDE.md — referencja do `@vytches/ddd-logging` po pełnym
        sprawdzeniu pliku okazała się faktycznie nieobecna (no-op, potwierdzone,
        nie wymuszona zmiana).
11. [x] **Gate kompilacji docs:** nowy pakiet `tools/docs-compile-gate/`
        (extractor + checker + CLI, wzorowany na `tools/ddd-lint`/
        `tools/example-matrix`), opt-in marker `compile-check` (nie
        hard-fail-na-każdym-fence), wpięty do CI (`ci.yml` +
        `pnpm docs-compile-gate:check`). 29/29 własnych testów, w tym fixture z
        celowo zepsutym fence'em.

## References

- Analysis: `project-orchestration/analysis/LIB-AUDIT-2026-07-02.analysis.md`
  (F-H16, F-M11, F-M12, F-M17 + Załącznik F)
- Analysis: `project-orchestration/analysis/VD-005.analysis.md` (approved, 6
  open questions answered)
- `docs/quickstart-validation-friction-log.md` — istniejący proces, do którego
  ten task dokłada obszar docs/
