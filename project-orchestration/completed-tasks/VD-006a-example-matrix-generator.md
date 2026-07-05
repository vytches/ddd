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
status: done
completed_at: 2026-07-05
release_target: unscheduled
package: tools/example-matrix, docs/
findings:
  [project-orchestration/analysis/VD-006-example-coverage-matrix.analysis.md]
```

## Completion Note (2026-07-05)

Implemented via `/orchestrate-ddd VD-006a` on
`feature/VD-006a-example-matrix-generator` (approved analysis:
`project-orchestration/analysis/VD-006-example-coverage-matrix.analysis.md`).
Workflow ran layered (core → cli-report → ci-wiring), each with an
implement→typecheck→verify loop; the `core` layer hit `max_attempts` once
(missing tests after a typecheck-fix attempt consumed a retry) and was recovered
via a targeted follow-up pass + `resumeFromRunId`, per the skill's
no-rerun-from-scratch rule, rather than restarting the whole run.

Independently re-verified (not just trusting the workflow's self-reported GO):
`pnpm nx run @vytches/example-matrix:test` — 49/49 passing; `tsc --noEmit`
clean; ran `--check` live against the real repo state and inspected the
generated `docs/COVERAGE-MATRIX.md`/`coverage-matrix.json` output by hand;
confirmed the AC#7 "additional report, not a substitute" disclaimer is present
in the rendered doc; confirmed the CI diff correctly separates hard-fail
(`exit 1`) from soft-fail (`::warning::`) paths.

Committed as `ff985aa9` (deliverable) on
`feature/VD-006a-example-matrix-generator`, not yet pushed/PR'd.

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

1. [x] Generator lives in `tools/example-matrix/`, mirroring the existing
       `tools/ddd-lint` structure (`src/scanner.ts`, `src/matrix.ts`,
       `src/report.ts`, `src/cli.ts`, `tests/`), using the TypeScript compiler
       API (already a dev-dependency) for AST parsing of
       `examples/*/src/NN-*.ts` files — not regex, not declared `package.json`
       deps. Done: `src/ast.ts` uses `typescript` compiler API; note
       `package.json` name is `@vytches/example-matrix` (not `@vytches/ddd-*`),
       flagged but not blocking.
2. [x] Three-phase algorithm: **Discover** (walk `examples/*/` for
       `package.json`, `src/**/*.ts`, `tests/**/*.test.ts`), **Extract**
       (AST-parse actual `@vytches/*` imports per example file; match each test
       file's import to its example file), **Correlate** (classify each
       `{package, level, combination}` cell as `VERIFIED` / `EXAMPLE_ONLY` /
       `DECLARED_MISSING` / `ABSENT`). Done: `src/scanner.ts` (Discover),
       `src/ast.ts` (Extract), `src/matrix.ts` (Correlate) — 4 states
       implemented.
3. [x] `expected-combinations.yaml` — one small, hand-maintained manifest
       declaring the AC1 baseline list of named combinations, **including a
       `level` field** (quick-start/intermediate/advanced) per combination —
       this is the ONLY manually-edited artifact; everything else is generated.
       Done: `tools/example-matrix/expected-combinations.yaml`, parsed/validated
       by `src/manifest.ts`.
4. [x] Output: `matrix.json` (canonical source of truth, committed) +
       `docs/COVERAGE-MATRIX.md` (human-readable render generated from it,
       committed). Done: real generated content — 5 VERIFIED, 1 EXAMPLE_ONLY, 5
       DECLARED_MISSING cells, verified by hand.
5. [x] CI `--check` mode (à la `prettier`/`tsc --noEmit`): fails the build if
       (a) any example file lacks a passing test, (b) any
       `expected-combinations.yaml` entry has no matching file, or (c) the
       committed `matrix.json`/`COVERAGE-MATRIX.md` is stale relative to current
       repo state. Done: `src/cli.ts` `--check` mode; ran live against real repo
       state during verification.
6. [x] Soft-fail (CI warning, not hard failure) when a new `examples/*/`
       directory appears with a combination not yet declared in
       `expected-combinations.yaml`, plus one PR-template checklist line
       pointing at the manifest — prevents it from becoming a second stale
       manifest like README/LLMGUIDE. Done: `ci.yml` step greps `^[soft` lines
       into `::warning::` annotations, hard-fails only on real gaps;
       `.github/pull_request_template.md` added.
7. [x] Documentation/AC wording must explicitly state that
       `matrix.json`/`COVERAGE-MATRIX.md` is an **additional** report alongside
       the existing L1/L2/L3 test-pyramid coverage gate, not a substitute for
       `vitest --coverage`. Done: disclaimer confirmed present in the rendered
       `docs/COVERAGE-MATRIX.md` header.
8. [x] **No new/fixed CI workflow needed for `examples/policies` or
       `examples/domain-services`** — confirmed empirically (2026-07-04) that
       both already run today via `nx affected --target=test` in `ci.yml`
       (proven against a real historical commit, `fa316eaf`). Do not add
       redundant CI wiring for this — the original task analysis's
       architect-stage assumption that these were "dead" in CI was incorrect.
       Confirmed: no redundant wiring added.

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
