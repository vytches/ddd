---
task: VD-006-example-coverage-matrix
status: approved
threat_model: null
rag:
  'skipped (.claude/config/knowledge.json not found — graceful fallback per
  /analyze-ddd step 0.6)'
patterns:
  - 'ts-library-patterns Rule 1 (explicit barrel exports, no export *) — governs
    D-5: scenario-eval/ must NOT be added to packages/testing/src/index.ts
    during the pilot'
  - 'ts-library-patterns Rule 6 (contract tests — public API behavior, not
    internals) — informs that a matrix cell going VERIFIED must be backed by a
    test exercising real public API surface, not implementation details'
  - 'ts-library-patterns Rule 7 (export validation — every declared export must
    exist and be importable) — conceptual precedent for the matrix mechanism
    itself: same "declared vs. actually verified" enforcement idea, applied to
    examples/combinations instead of package exports'
  - 'ts-library-patterns package-boundary-pattern (Nx deps, acyclic graph) —
    governs D-1: tools/ (internal, not published) vs packages/testing
    (published) have different exposure/dependency rigor'
  - 'project CLAUDE.md: "Every exported class/function must have corresponding
    unit tests" — the existing rule this task extends into
    examples/combinations, not a replacement for it (see risk R-3)'
  - 'in-repo precedent: tools/ddd-lint (src/runner.ts, src/cli.ts,
    formatResult()) — closest existing generator/checker shape, reused as the
    template for tools/example-matrix'
  - 'in-repo precedent: examples/policies/tests/policies-examples.test.ts +
    vitest.config.mts — the only proven compile-and-run harness pattern,
    extended rather than reinvented'
  - 'in-repo precedent: packages/testing/src/gwt/aggregate-test-builder.ts,
    packages/testing/src/core/test-clock.ts — reusable GWT/TestClock primitives,
    base for the scenario-eval semantic layer instead of a new abstraction'
open_questions:
  - id: OQ-1
    question: >-
      Approve splitting VD-006 into two separate backlog tasks — VD-006a
      (generator + CI wiring, mechanical compile-and-run enforcement, ~8h,
      matches AC#2/AC#3) and VD-006b (semantic "is this combination sensible"
      eval harness + 2 pilots, ~10h, R&D with zero precedent in this repo,
      matches AC#4) — instead of running the original 8h estimate as a single
      unit? Both panel stages independently concluded the 8h estimate cannot
      cover AC#1-#5 as one unit, because AC#4 is greenfield work with no
      existing eval/golden-query mechanism anywhere in the repo (confirmed by
      grep, per the task's own "Why" section).
    answer: >-
      Approved. Split into VD-006a (generator + CI, ~8h) and VD-006b
      (semantic-eval + pilots, ~10h R&D). VD-006a runs first — it defines the
      manifest schema (expected-combinations.yaml, see OQ-3) that VD-006b's
      pilots must conform to. Human/subsequent step still required to actually
      create the two task files (this artifact cannot, same precedent as
      VB-004's OQ-3 → VF-027).
  - id: OQ-2
    question: >-
      Empirical check needed before finalizing generator scope: does `nx
      affected --target=test` actually run examples/policies and
      examples/domain-services tests today (they ARE visible Nx projects with a
      `test` target matching ci.yml's), or are they silently skipped in practice
      despite having the right target? The architect stage asserted they never
      run in CI (based on the absence of a dedicated workflow like
      quickstart-validation.yml); the quality-verifier stage found they *should*
      run via the general dependency graph but could not confirm this
      empirically in the time available. This determines whether "wire
      examples/* into CI" is required remedial work inside VD-006a or already
      covered.
    answer: >-
      RESOLVED empirically (2026-07-04) — both DO run today. `pnpm nx show
      projects --with-target=test` confirms `@vytches/policies-examples` and
      `@vytches/domain-services-examples` are registered Nx projects with a
      `test` target (Nx infers it from each example's npm `test` script via
      pnpm-workspace.yaml's `examples/**` glob). `.github/workflows/ci.yml`'s
      "Test affected projects" step (`nx affected --target=test --parallel=3
      --verbose`) has no exclude/filter, and neither `paths-ignore` nor
      `.nxignore` touch `examples/`. Direct proof: `nx show projects --affected
      --base=fa316eaf~1 --head=fa316eaf --with-target=test` against a real
      historical commit that touched both `examples/domain-services` and
      `packages/policies` correctly flagged both example projects as affected.
      The architect's original claim was incorrect; the verifier's reading was
      correct. Consequence: "wire examples/* into CI" is NOT required remedial
      work — VD-006a's scope narrows accordingly (no new/fixed workflow needed,
      only the generator + --check job).
  - id: OQ-3
    question: >-
      Where does the quick-start/intermediate/advanced level classification for
      a matrix cell come from? The current example convention is a flat
      `examples/<pkg>/src/NN-name.ts` numbering with no directory or metadata
      field encoding difficulty level. Options: (a) a directory-per-level
      convention going forward, (b) a field in expected-combinations.yaml, (c)
      drop the level dimension for v1 and only track package×combination. This
      must be settled before the generator's data model is fixed, since it
      changes the discovery/extract logic.
    answer: >-
      Option (b) — a field in expected-combinations.yaml. Keeps the existing
      flat `src/NN-name.ts` convention untouched (no directory restructure) and
      centralizes level classification alongside the same manifest that already
      declares which combinations should exist (D-4) — one place to maintain,
      not two.
  - id: OQ-4
    question: >-
      Does packages/testing/package.json's `exports` field include a wildcard
      subpath (e.g. "./*")? If so, adding scenario-eval/ under
      packages/testing/src/ makes it reachable via deep-import
      (@vytches/ddd-testing/scenario-eval/...) regardless of whether it's listed
      in index.ts's barrel — the "@internal until promoted" plan (D-5) would
      then be a paper safeguard, not a real one, and a stricter isolation
      mechanism (narrower exports map, or a location outside packages/testing
      entirely) would be needed instead. One Read of the file resolves this
      before implementation starts.
    answer: >-
      RESOLVED (2026-07-04) — no wildcard. Full `exports` map is `{".":
      {"types": "./dist/index.d.ts", "import": "./dist/index.js", "require":
      "./dist/index.cjs"}}` — a single "." key, nothing else. Deep-import
      (`@vytches/ddd-testing/dist/...` or any subpath) is blocked by Node itself
      (`ERR_PACKAGE_PATH_NOT_EXPORTED`). D-5's "@internal, unexported during the
      pilot" plan is safe as designed — no additional isolation mechanism
      needed.
  - id: OQ-5
    question: >-
      Will matrix.json (the generator's source-of-truth output) be committed to
      the repo, or regenerated ephemerally in CI only? If committed, what
      enforces it staying in sync with examples/*/src as new examples are added
      — is the --check mode alone (D-3) sufficient, or does it need an explicit
      CI job separate from the example tests themselves? This is the exact
      failure mode the audit already found once (README/LLMGUIDE drift) — the
      matrix must not repeat it.
    answer: >-
      Yes, commit both matrix.json and COVERAGE-MATRIX.md. The --check mode
      (D-3) alone is sufficient as the sync-enforcement mechanism — it's the
      same idiom this repo already uses for prettier/tsc --noEmit-style drift
      checks, no separate CI job needed beyond the one --check step.
  - id: OQ-6
    question: >-
      After the VD-006b pilot, who or what is responsible for keeping
      expected-combinations.yaml (the one hand-maintained manifest) up to date
      as new examples/combinations are added? Is there a process hook (PR
      template checklist, CODEOWNERS review, or a CI check that flags new
      examples/ directories not yet reflected in the manifest), or does this
      rely on manual diligence — which is exactly the failure mode this whole
      task exists to prevent?
    answer: >-
      Extend --check (D-3) with a soft-fail (warning, not hard CI failure)
      whenever a new examples/*/ directory appears with a combination not yet
      declared in expected-combinations.yaml, plus one PR-template checklist
      line pointing at it. Pure manual diligence with zero tooling backstop is
      exactly the failure mode this task exists to eliminate — the manifest
      needs at least a soft nudge, even if not a hard block.
  - id: OQ-7
    question: >-
      The original task text says "golden-query eval" for the semantic
      sensibility check; the architect stage recommends explicitly dropping that
      in favor of deterministic runtime-assertions (observable behavior: call
      counts, backoff timing, circuit state, Result vs. throw) plus an optional
      DDD-invariant layer, with zero golden-query/LLM-eval, to avoid
      non-determinism and any new dependency. Confirm this substitution is
      acceptable — it changes what "semantically sensible" means for AC#4 from
      the task's original framing.
    answer: >-
      Confirmed — substitution accepted. Golden-query/LLM-eval would introduce
      non-determinism and, in most realistic implementations, a new dependency,
      both of which violate this library's dependency-free constraint.
      Deterministic runtime-assertions (call counts, TestClock- driven backoff
      timing, circuit-breaker state, Result-vs-throw) fully cover the intent of
      "is this combination behaviorally sensible" without either cost.
  - id: OQ-8
    question: >-
      Does bundle-size-monitor.js measure packages/testing's pre-build `src`
      size or post-build/tree-shaken `dist` size? If it's `src`-based, an
      @internal, unexported scenario-eval/ submodule could still trip the
      bundle-size gate even though it never reaches a consumer's bundle — worth
      confirming (and, if needed, getting a one-time threshold adjustment)
      before VD-006b adds code there.
    answer: >-
      RESOLVED (2026-07-04) — measures `src` (pre-build), not `dist`.
      scripts/quality-gates/bundle-size-monitor.js's checkThresholds() compares
      `result.sourceSize` (computed from packages/*/src/**/*.ts, excluding
      *.test.ts/*.spec.ts) against a per-package threshold; `builtSize`/dist is
      informational only, never checked. The `@vytches/ddd-testing` threshold is
      explicitly 150KB. This means the risk is REAL, not theoretical: any code
      added under packages/testing/src/scenario-eval/ counts against that 150KB
      limit even though it's never exported/bundled for consumers. Action before
      VD-006b starts: measure current packages/testing/src size vs. the 150KB
      threshold to confirm headroom exists; if not, request a one-time threshold
      bump justified by "@internal pilot code, not consumer-facing." (Side note:
      the monitor's getPackageDirectories() only scans packages/, so
      examples/policies and examples/domain-services are outside its scope
      entirely — irrelevant to VD-006a.)
decisions:
  - id: D-1
    decision: >-
      Generator lives in a new tools/example-matrix/ package, structurally
      mirroring the existing tools/ddd-lint (src/scanner.ts, src/matrix.ts,
      src/report.ts, src/cli.ts, tests/), using the TypeScript compiler API
      (already a dev-dependency) for AST parsing — not regex.
    rationale: >-
      tools/ is unpublished and outside the bundle-size monitor's scan scope
      (confirmed: the monitor only walks packages/), so it carries none of the
      dependency-free/bundle-size rigor that applies to published packages.
      ddd-lint is the closest existing precedent for "enforceable rule via
      static analysis" in this repo — reusing its shape avoids inventing a new
      tool architecture from scratch.
    adr: null
    propose_adr: false
  - id: D-2
    decision: >-
      Three-phase algorithm — Discover (walk examples/*/ for package.json,
      src/**/*.ts, tests/**/*.test.ts), Extract (AST-parse each example file for
      actually-imported @vytches/* symbols, not declared package.json deps;
      match each test file's import to its example file), Correlate (classify
      each {package, level, combination} cell as VERIFIED / EXAMPLE_ONLY /
      DECLARED_MISSING / ABSENT). Output is matrix.json (canonical,
      machine-truth) with COVERAGE-MATRIX.md generated from it as a
      human-readable render.
    rationale: >-
      AST-based extraction of actual imports (not package.json declarations or
      regex) is the only way to detect which packages a given example file
      genuinely combines — declared deps can include unused workspace packages.
      JSON-as-truth-then-render-to-Markdown mirrors ddd-lint's formatResult()
      pattern already used in this repo.
    adr: null
    propose_adr: false
  - id: D-3
    decision: >-
      CI enforcement is a `--check` mode (à la prettier/tsc --noEmit): fail the
      build if any example file lacks a passing test, any
      expected-combinations.yaml entry has no matching file, or (if OQ-5 answers
      "commit it") the committed matrix.json/COVERAGE-MATRIX.md is stale
      relative to current repo state.
    rationale: >-
      Deterministic, no-new-dependency enforcement mechanism consistent with how
      existing static checks in this repo work; directly targets the failure
      mode from the 2026-07-03 audit (docs silently drifting from code) by
      making drift a CI failure instead of a manual-review miss.
    adr: null
    propose_adr: false
  - id: D-4
    decision: >-
      expected-combinations.yaml (a small, hand-maintained manifest declaring
      the AC#1 baseline list of named combinations and levels) is the ONLY
      manually-edited artifact in this mechanism; matrix.json and
      COVERAGE-MATRIX.md are fully generated.
    rationale: >-
      Someone has to declare intent/ambition (which combinations SHOULD exist) —
      that can't be derived from repo state alone. Keeping this one manual file
      small and YAML (not embedded in the generator or scattered across example
      READMEs) matches this project's existing convention of
      YAML-as-source-of-truth for declarative rules (BUSINESS_RULES.yaml
      precedent), and minimizes what can silently rot — see OQ-6 for its
      ongoing-maintenance risk.
    adr: null
    propose_adr: false
  - id: D-5
    decision: >-
      Semantic evaluators (AC#4) extend the published packages/testing package
      with a new src/scenario-eval/ submodule, reusing its existing GWT builder
      (given/when/then/thenError) and TestClock rather than building a parallel
      harness — NOT added to packages/testing/src/index.ts's barrel, kept
      unexported/@internal for the duration of the pilot.
    rationale: >-
      packages/testing already has the exact runtime primitives a behavioral
      evaluator needs (controllable time for retry/backoff, structured
      given/when/then assertions), and semantic-eval primitives are plausibly
      valuable to library consumers later (unlike tools/, which is repo-
      internal only) — but promoting to public API before the pilot proves the
      approach would lock in an unvalidated contract. Barrel discipline (Rule 1)
      keeps it out of the public surface for now; OQ-4 (resolved) confirmed
      packages/testing/package.json's exports map has no wildcard subpath, so
      this barrel discipline is fully sufficient — no residual deep-import risk.
    adr: null
    propose_adr: false
  - id: D-6
    decision: >-
      "Semantically sensible" (AC#4) is defined as deterministic runtime
      assertions on observable behavior (call counts, backoff delay progression,
      circuit-breaker state transitions, Result-vs-throw contract) as the
      required core, with an optional DDD-invariant check as a second layer.
      Golden-query / snapshot / LLM-based evaluation is explicitly rejected for
      v1 — see OQ-7 for required human confirmation, since it changes the task's
      original framing.
    rationale: >-
      Golden-query/LLM-eval would introduce non-determinism and, in most
      practical implementations, a new dependency — both violate this project's
      dependency-free constraint and its no-flaky-tests posture. Deterministic
      runtime-assertions are fully expressible with existing packages/testing
      primitives (TestClock makes backoff timing assertions deterministic
      instead of relying on real wall-clock waits).
    adr: null
    propose_adr: false
  - id: D-7
    decision: >-
      The matrix is published as a committed file, docs/COVERAGE-MATRIX.md,
      generated from matrix.json (also committed), enforced via CI --check
      (D-3). An optional PR comment (reusing the existing actions/github- script
      pattern from quickstart-validation.yml) surfaces
      EXAMPLE_ONLY/DECLARED_MISSING cells for visibility, but the committed file
      — not an ephemeral CI report — is the artifact of record.
    rationale: >-
      A committed, diffable file makes coverage regressions visible in normal PR
      review and is visible to library consumers browsing the repo/npm docs; a
      CI-only report would be invisible outside of pipeline logs and wouldn't
      function as "a specification you can see," which is the task's stated
      intent.
    adr: null
    propose_adr: false
  - id: D-8
    decision: >-
      Two pilot combinations for AC#4, in order: Pilot A —
      CircuitBreakerDecorator wrapping a real @CommandHandler under
      retry/backoff (asserts: retry count matches maxAttempts, TestClock- driven
      backoff actually advances, circuit opens and short-circuits after
      threshold, handler always returns Result never throws) as the harder
      proof-of-concept; Pilot B — aggregate + specification (asserts:
      specification violation produces thenError(code), not silent success) as a
      simpler validation that the GWT harness suffices for the domain layer.
    rationale: >-
      Pilot A is deliberately the hardest case in the AC#1 baseline list — if it
      can be expressed cleanly with existing packages/testing helpers and no new
      dependencies, the harness architecture is proven; Pilot B is cheap
      insurance that the same harness generalizes to a structurally different
      (domain-model, not resilience-decorator) combination.
    adr: null
    propose_adr: false
decisions_meta:
  note: >-
    D-8's pilots and the VD-006b split (OQ-1) both require the
    examples/cqrs-resilience example directory to be created — it does not exist
    yet (confirmed: only examples/quickstart, examples/policies,
    examples/domain-services exist today). This is real new-example authoring
    work, not just harness wiring, and is folded into the VD-006b R&D estimate,
    not a hidden addition.
---

## Summary

VD-006 asks for a coverage matrix that is enforced by machinery, not by hand-
checked boxes — directly motivated by the 2026-07-03 example-coverage audit,
which found README/LLMGUIDE drift in 7 packages because nothing forced docs to
match code. A three-stage panel (architect → library-quality-verifier →
tech-lead synthesis) converged on a two-layer design: a **generator**
(`tools/example-matrix/`, mirroring the existing `tools/ddd-lint`) that proves
combinations exist and compile-and-run, plus a **semantic evaluator layer**
(extending `packages/testing`) that proves a combination behaves correctly, not
just type-checks.

The headline finding, requiring human sign-off before any implementation: the
task's 8h estimate — already flagged by @product-owner in TEAM-STATE.md as
unvalidated — **cannot** cover both layers. The generator/CI-enforcement half
(AC#2/#3) is mechanical and well-scoped at ~8h; the semantic-eval half (AC#4) is
genuine R&D with **zero precedent anywhere in this repo** (confirmed by grep in
the task's own "Why" section) and realistically needs its own ~10h, including
authoring a new `examples/cqrs-resilience` example that doesn't exist yet. The
panel recommends splitting into VD-006a (mechanism) and VD-006b (semantic-eval +
2 pilots, with an explicit pass/fail exit criterion so it can't run open-ended)
— see OQ-1 (approved).

**Post-analysis update (2026-07-04):** all 8 open questions have been answered —
see each `answer:` in the frontmatter. Three were empirical facts resolved by
direct verification rather than judgment calls: OQ-2 (examples/\* already run in
CI today — narrows VD-006a's scope, no CI-wiring work needed), OQ-4 (no exports
wildcard — D-5's @internal plan is safe as designed, no extra isolation
mechanism required), and OQ-8 (bundle-size monitor measures `src`, confirming
the 150KB-threshold risk for `packages/testing` is real, not theoretical — check
headroom before VD-006b starts). The remaining five (OQ-1, OQ-3, OQ-5, OQ-6,
OQ-7) are judgment calls, answered per the recommendations above.

## Panel findings by area

### Architecture (architect)

Grounded every recommendation in real repo state, not assumption: confirmed only
3 of 19 packages have an `examples/` directory at all (matches the audit),
confirmed the stable `src/NN-name.ts` + `tests/*.test.ts` convention, and
identified `tools/ddd-lint` as the right architectural template for the
generator (AST-based, dependency-free, already has the runner/formatter/CLI
shape this needs). Recommended AST-extraction of _actual_ imports (not declared
package.json deps) as the only reliable way to detect real combinations. Also
raised — and flagged as requiring a human decision, not a default assumption —
that the task's "golden-query eval" framing should be replaced with
deterministic runtime-assertions (see OQ-7, D-6).

One architect claim did **not** survive the next stage unchanged: that
`examples/policies` and `examples/domain-services` tests "never run in CI." See
the discrepancy note below.

### Library quality (library-quality-verifier)

Confirmed `packages/testing/src/index.ts` is a disciplined explicit barrel (good
— Rule 1 compliance already exists), but flagged that physical presence of new
code under `packages/testing/src/` reaches `dist/` regardless of barrel exports,
and could be deep-importable if `package.json#exports` has a wildcard subpath —
unverified in this pass (OQ-4). Flagged a medium risk that `matrix.json` could
be mistaken for a substitute of the existing L1/L2/L3 coverage gate rather than
an additional report (must be explicit in implementation-phase AC). Most
importantly, **corrected** the architect's CI claim: `examples/policies` and
`examples/domain-services` are visible Nx projects with a `test` target
identical to the one `ci.yml`'s `nx affected --target=test` invokes — they
_should_ run via the dependency graph, but this was not empirically confirmed
either way in the time available (OQ-2). Agreed with the VD-006a/VD-006b split
and added a required condition: VD-006b's pilot needs an explicit exit criterion
(pass/fail after ~10h), not an open-ended research effort.

### Synthesis (tech-lead)

Reconciled both stages into the decisions and open questions above, carrying
forward the corrected (unverified, not asserted) framing of the CI-examples
question, and confirming the two-unit split recommendation with the added pilot
exit-criterion condition.

## Discrepancy: "examples/policies and examples/domain-services never run in CI" — RESOLVED

**Resolved 2026-07-04, in favor of the verifier's reading.** The architect stage
asserted these tests never run in CI, based on the absence of a dedicated
workflow file (only `quickstart-validation.yml` exists). The
library-quality-verifier stage pushed back — both directories are registered Nx
projects with a `test` target matching `ci.yml`'s general
`nx affected --target=test` step — but couldn't confirm it empirically in time.
A direct check
(`nx show projects --affected --base=fa316eaf~1 --head=fa316eaf --with-target=test`
against a real historical commit that touched both `examples/domain-services`
and `packages/policies`) confirmed both example projects ARE flagged as affected
and DO run today, with no exclude/filter in `ci.yml`, `paths-ignore`, or
`.nxignore` touching `examples/`. **Consequence: VD-006a's scope is narrower
than the architect's original estimate assumed — no CI-wiring work is needed,
only the generator + `--check` job.** See OQ-2.

## Risks

| Risk                                                                                                | Level                                    | Status                                                                                                                    |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `scenario-eval/` reachable via deep-import despite `@internal` intent                               | ~~medium~~ closed                        | RESOLVED (OQ-4): no exports wildcard exists                                                                               |
| CI-examples claim (architect vs. verifier) — scope of VD-006a depended on the answer                | ~~medium~~ closed                        | RESOLVED (OQ-2): both already run in CI, VD-006a scope narrowed                                                           |
| bundle-size monitor counts experimental code in `packages/testing` toward the 150KB threshold       | medium (confirmed real, not theoretical) | RESOLVED-AS-RISK (OQ-8): src-based measurement confirmed — action needed: check current headroom before VD-006b adds code |
| `matrix.json`/`COVERAGE-MATRIX.md` mistaken for a substitute of the existing L1/L2/L3 coverage gate | medium                                   | Open — needs explicit AC wording at implementation time                                                                   |
| VD-006b pilot becomes open-ended without an exit criterion                                          | medium-high                              | Mitigated by D-8's explicit pass/fail exit condition                                                                      |
| `expected-combinations.yaml` becomes a second stale manifest (same failure mode as README/LLMGUIDE) | medium                                   | Mitigated by OQ-6's soft-fail --check extension + PR checklist item                                                       |

## Process notes

- No `.claude/config/preset.yml`, `.claude/config/knowledge.json`,
  `.claude/config/canonical-labels.yml`, `.claude/knowledge/patterns/`, or
  `.claude/knowledge/decisions/` exist in this project — RAG retrieval,
  pattern-card grounding, and decision-card grounding all fell back to graceful
  defaults (the `ts-library-patterns` skill + project CLAUDE.md + in-repo
  precedent read directly by each panel stage), consistent with prior analyses
  in this repo (VB-004, VD-007).
- No threat-model was run — this task is a tooling/docs mechanism with no auth,
  PII, or cross-context surface.
- This artifact does not create the VD-006a/VD-006b task files even if OQ-1 is
  answered "split" — that is a human/subsequent step (same precedent as VB-004's
  OQ-3 → VF-027).
