# Task: Semantic combination-sanity evaluator harness + pilots (R&D, bounded)

## Task Metadata

```yaml
task_id: VD-006b
title:
  Evaluator harness proving a package combination behaves correctly, not just
  compiles — the semantic-sanity half of VD-006, greenfield R&D with an explicit
  exit criterion
type: research
priority: normal
complexity: complex
estimated_time:
  10h (R&D — explicit pass/fail exit criterion at ~10h, not open-ended)
created_by:
  human (split from VD-006 per /analyze-ddd panel recommendation, OQ-1 approved
  2026-07-04)
created_at: 2026-07-04
status: backlog
release_target: unscheduled
package: packages/testing, examples/cqrs-resilience (new)
depends_on: VD-006a
findings:
  [project-orchestration/analysis/VD-006-example-coverage-matrix.analysis.md]
```

## Why

VD-006's `/analyze-ddd` panel confirmed there is **zero existing eval/golden-
query mechanism anywhere in this repo** (grep, zero hits) for answering "is this
combination of packages not just type-clean, but behaviorally sensible" (e.g.
does `CircuitBreakerDecorator` on a real `@CommandHandler` actually
retry/back-off/open correctly). This is genuine R&D, split out of VD-006 so it
doesn't silently eat the mechanical generator's (VD-006a) budget, and bounded
with an explicit exit criterion so it can't run open-ended.

Depends on VD-006a for the `expected-combinations.yaml` manifest schema
(specifically its `level` field) being settled first.

## Acceptance Criteria

1. [ ] New `packages/testing/src/scenario-eval/` submodule, reusing the existing
       GWT builder (`given/when/then/thenError`) and `TestClock` rather than
       building a parallel harness. **Not added to
       `packages/testing/src/index.ts`'s barrel** — kept unexported/`@internal`
       for the duration of the pilot (confirmed safe: `package.json#exports` has
       no wildcard subpath, so this is a real boundary, not a paper one).
2. [ ] "Semantically sensible" is defined as **deterministic runtime assertions
       on observable behavior** (call counts, backoff delay progression via
       `TestClock`, circuit-breaker state transitions, Result-vs-throw contract)
       as the required core, with an optional DDD-invariant check as a second
       layer. **Zero golden-query / snapshot / LLM-based evaluation** —
       confirmed acceptable substitution for the task's original "golden-query
       eval" framing (avoids non-determinism and any new dependency in this
       dependency-free library).
3. [ ] **Pilot A** (harder, proof-of-concept): new `examples/cqrs-resilience`
       example — `CircuitBreakerDecorator` wrapping a real `@CommandHandler`
       under retry/backoff. Required assertions: (a) retry count matches
       configured `maxAttempts` (not 1, not unbounded); (b) `TestClock`-driven
       backoff delay actually progresses between attempts; (c) after crossing
       the failure threshold, the circuit opens and short-circuits — the next
       call does NOT reach the handler; (d) the handler always returns a
       `Result`, never throws.
4. [ ] **Pilot B** (simpler validation): aggregate + specification example —
       assert that a specification violation produces `thenError(code)`, not a
       silent success, proving the GWT harness suffices for the domain layer
       too.
5. [ ] **Explicit exit criterion, checked at ~10h of effort**: PASS if both
       pilots are expressible cleanly using only existing `packages/testing`
       helpers, no new dependencies, and the harness reads as genuinely reusable
       for future combinations. FAIL if either pilot needs a new abstraction,
       produces a false positive/negative, or is unstable — if FAIL,
       `scenario-eval/` remains `@internal` indefinitely; do not attempt
       public-API promotion.
6. [ ] Before adding code to `packages/testing/src/`: confirm current
       `packages/testing/src` size has headroom under the 150KB
       `bundle-size-monitor.js` threshold (confirmed src-based measurement,
       2026-07-04 — this is a real constraint, not theoretical). If no headroom,
       request a one-time threshold adjustment justified as "@internal pilot
       code, not consumer-facing" before proceeding.

## Out of scope

- Promoting `scenario-eval/` to public API / adding it to the barrel — only
  attempted as a later, separate task if the exit criterion (AC#5) passes.
- Filling in the rest of the coverage matrix's cells with new examples —
  separate, per-combination tasks.
- The generator/CI-enforcement mechanism itself — that's VD-006a.

## References

- Analysis:
  `project-orchestration/analysis/VD-006-example-coverage-matrix.analysis.md`
  (decisions D-5, D-6, D-8; resolved OQ-4, OQ-7, OQ-8)
- Reusable primitives: `packages/testing/src/gwt/aggregate-test-builder.ts`,
  `packages/testing/src/core/test-clock.ts`
- Sibling task: VD-006a (generator + CI) — must land first; this task consumes
  its manifest schema
