# Task: Example coverage matrix generator + CI enforcement (compile-and-run mechanism)

## Task Metadata

```yaml
task_id: VD-006a
title:
  Generator that derives the package × combination coverage matrix from repo
  state and enforces it in CI — the mechanical, compile-and-run half of VD-006
type: feature
priority: normal
complexity: moderate
estimated_time: 8h
created_by:
  human (split from VD-006 per /analyze-ddd panel recommendation, OQ-1 approved
  2026-07-04)
created_at: 2026-07-04
status: backlog
release_target: unscheduled
package: tools/example-matrix, docs/
findings:
  [project-orchestration/analysis/VD-006-example-coverage-matrix.analysis.md]
```

## Why

VD-006's `/analyze-ddd` panel found the original 8h estimate could not cover
both a mechanical compile-and-run matrix AND a semantic "is this combination
sensible" evaluator — the latter is greenfield R&D with zero precedent in this
repo. The panel recommended splitting the task; this is the mechanical half: a
script-generated matrix, not a hand-edited one, enforced in CI so it can't drift
the way README/LLMGUIDE already have (2026-07-03 audit).

VD-006b (semantic-eval harness + pilots) is a separate, dependent task — see
References.

## Acceptance Criteria

1. [ ] Generator lives in `tools/example-matrix/`, mirroring the existing
       `tools/ddd-lint` structure (`src/scanner.ts`, `src/matrix.ts`,
       `src/report.ts`, `src/cli.ts`, `tests/`), using the TypeScript compiler
       API (already a dev-dependency) for AST parsing of
       `examples/*/src/NN-*.ts` files — not regex, not declared `package.json`
       deps.
2. [ ] Three-phase algorithm: **Discover** (walk `examples/*/` for
       `package.json`, `src/**/*.ts`, `tests/**/*.test.ts`), **Extract**
       (AST-parse actual `@vytches/*` imports per example file; match each test
       file's import to its example file), **Correlate** (classify each
       `{package, level, combination}` cell as `VERIFIED` / `EXAMPLE_ONLY` /
       `DECLARED_MISSING` / `ABSENT`).
3. [ ] `expected-combinations.yaml` — one small, hand-maintained manifest
       declaring the AC1 baseline list of named combinations, **including a
       `level` field** (quick-start/intermediate/advanced) per combination —
       this is the ONLY manually-edited artifact; everything else is generated.
4. [ ] Output: `matrix.json` (canonical source of truth, committed) +
       `docs/COVERAGE-MATRIX.md` (human-readable render generated from it,
       committed).
5. [ ] CI `--check` mode (à la `prettier`/`tsc --noEmit`): fails the build if
       (a) any example file lacks a passing test, (b) any
       `expected-combinations.yaml` entry has no matching file, or (c) the
       committed `matrix.json`/`COVERAGE-MATRIX.md` is stale relative to current
       repo state.
6. [ ] Soft-fail (CI warning, not hard failure) when a new `examples/*/`
       directory appears with a combination not yet declared in
       `expected-combinations.yaml`, plus one PR-template checklist line
       pointing at the manifest — prevents it from becoming a second stale
       manifest like README/LLMGUIDE.
7. [ ] Documentation/AC wording must explicitly state that
       `matrix.json`/`COVERAGE-MATRIX.md` is an **additional** report alongside
       the existing L1/L2/L3 test-pyramid coverage gate, not a substitute for
       `vitest --coverage`.
8. [ ] **No new/fixed CI workflow needed for `examples/policies` or
       `examples/domain-services`** — confirmed empirically (2026-07-04) that
       both already run today via `nx affected --target=test` in `ci.yml`
       (proven against a real historical commit, `fa316eaf`). Do not add
       redundant CI wiring for this — the original task analysis's
       architect-stage assumption that these were "dead" in CI was incorrect.

## Out of scope

- The semantic "is this combination behaviorally sensible" evaluator
  (`packages/testing/src/scenario-eval/`) and its pilots — that is VD-006b.
- Filling in every matrix cell with new examples — separate, per-combination
  tasks once this mechanism is settled.

## References

- Analysis:
  `project-orchestration/analysis/VD-006-example-coverage-matrix.analysis.md`
  (decisions D-1 through D-4, D-7; resolved OQ-2, OQ-3, OQ-5, OQ-6)
- Pattern: `tools/ddd-lint` (`src/runner.ts`, `src/cli.ts`, `formatResult()`)
- Pattern: `examples/policies/tests/policies-examples.test.ts` +
  `vitest.config.mts` — the only proven compile-and-run harness pattern,
  extended rather than reinvented
- Sibling task: VD-006b (semantic-eval harness + pilots) — depends on this
  task's manifest schema (`level` field) being settled first
