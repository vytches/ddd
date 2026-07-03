# Task: LLMGUIDE.md completeness pass — document the undocumented public API

## Task Metadata

```yaml
task_id: VD-007
title:
  Close the gap between src/index.ts exports and LLMGUIDE.md coverage across all
  19 packages
type: documentation
priority: normal
complexity: complex
estimated_time: 20h (spans 19 files; scope down per package during /analyze-ddd)
created_by:
  human (feedback 2026-07-03, round 2 of project_examples_coverage_audit)
created_at: 2026-07-03
status: done
release_target: pre-first-public-publish (recommended — see Why)
package: packages/*/LLMGUIDE.md
findings:
  [project_examples_coverage_audit memory, delivered artifact 2026-07-03]
completed_at: 2026-07-03
```

## Completion Note (2026-07-03)

Implemented via `/analyze-ddd` (approved analysis:
`project-orchestration/analysis/VD-007-llmguide-completeness-pass.analysis.md`,
decisions D-1..D-9, units U-0..U-11) and five sequential `/orchestrate-ddd`
batches (D-8 volume-balanced batching, one Workflow script per batch,
`project-orchestration/.workflow/`, gitignored scratch):

- **Batch 1**: `di` stale-API pre-flight correction (D-2) + units `di`,
  `validation`, `acl`, `cqrs`, `domain-services` — all GO.
- **Batch 2**: `domain-services` combo-enrichment fix (human feedback after
  batch 1 review — row-only pass was too thin) + `testing`, `nestjs`,
  `aggregates` — all GO.
- **Batch 3**: `contracts` (~70 symbols, solo run per D-8) — GO on first
  attempt.
- **Batch 4**: `policies` (~61 symbols) — GO after one fix cycle (verifier
  caught a real fabrication: `withEvents` documented as a 2-arg positional call,
  actual signature is curried).
- **Batch 5**: `enterprise` (last, per D-6) — cross-reference table +
  naming-conflict resolution section (D-5), not full per-symbol parity.

Also folded in packages discovered mid-analysis but missed by the original
audit: `acl`, `aggregates`, `cqrs`, `domain-services` (OQ-1, answered yes).

**AC #7 verification**: independent re-audit (11 parallel Explore agents, same
grep-every-export-against-LLMGUIDE methodology as the original audit) across all
11 touched packages — zero remaining zero-mention symbols in any of them; `di`'s
stale names (`IContainer`/`Lifetime`/`ContainerError`) confirmed gone.

Committed as three separate commits on
`feature/VD-007-llmguide-completeness-pass`: `f62e7cdf` (11 packages'
LLMGUIDE.md), `6b570f21` (`.gitignore` — unrelated repo-hygiene entry for the
Workflow scratch dir), `025c1312` (analysis artifact). Pre-commit hooks ran
clean (283 tests, 16 files, 22 Nx projects, no circular deps) — no `--no-verify`
used (project hook hard-blocks it).

## Why

A follow-up to the example-coverage audit: the user flagged that
`packages/validation/src/rules-registry.ts` exports `RulesRegistry`, which has
zero mentions anywhere in `validation/LLMGUIDE.md`. A full grep of every
exported symbol name (from each package's `src/index.ts` barrel) against its
`LLMGUIDE.md` confirmed this is systemic, not an isolated miss:

- **300+ undocumented exports total** across the library.
- Worst offenders by % of exports with zero mention: `testing` 74% (28/38 — the
  entire seeder framework: `DomainSeeder`, `ScenarioSeeder`, `StreamingSeeder`,
  `GeographicSeeder`, `EventSourcedSeeder`, `AIEnhancedSeeder`,
  `ValueObjectBuilder`, `AggregateFactory`, `EntityIdGenerator`, plus the GWT
  step interfaces `GivenStep`/`WhenStep`/ `ThenStep`), `contracts` 74% (70/94 —
  the entire event-store/replay layer), `policies` 71% (61/86 — the entire
  conditional/group builder subsystem and the policy event system), `nestjs` 71%
  (12/17 — including `VytchesDDDFeatureModule` itself), `di` 69% (18/26),
  `validation` 67% (16/24 — the entire specification-combinator internals:
  `AndSpecification`, `OrSpecification`, `NotSpecification`,
  `PredicateSpecification`, etc., plus `ValidationFacade`,
  `BaseValidationAdapter`, `AdapterUtils`, `RulesRegistry`). `enterprise` sits
  at 91% but is largely structural — it's a curating meta-package by design and
  inherits gaps from the packages it re-exports.
- `di` has a distinct correctness bug, not just a gap: its Key API table
  describes `IContainer`, `Lifetime`, `ContainerError` — none of which exist as
  actual exports (the real names are `IDependencyContainer`, `ServiceLifetime`,
  `DIError`). The table describes a no-longer-existing API shape.
- Well covered already (zero fully-undocumented exports): `domain-primitives`,
  `projections`, `repositories`, `resilience` (though 46/57 of its exports are
  table-only, never shown in a code sample), `messaging`, `events`,
  `value-objects`, `utils`.

This directly undercuts the assumption — reasonable on the surface, since every
LLMGUIDE.md follows an identical
`Purpose → Quick Start → Key API → Patterns → Anti-Patterns` structure — that
the files are a reliable source of truth. Structure consistency does not imply
coverage.

## Acceptance Criteria

1. [x] `di`: fix the Key API table entries describing non-existent symbols
       (`IContainer` → `IDependencyContainer`, `Lifetime` → `ServiceLifetime`,
       `ContainerError` → `DIError`) — a correction, not an addition. Done in
       batch 1 pre-flight (D-2); confirmed gone in AC #7 re-audit.
2. [x] For each undocumented export identified in the audit, add at minimum a
       Key API table row with an accurate description sourced from the code
       (JSDoc/signature) — no fabricated behavior. All 11 touched packages at
       zero zero-mention symbols per AC #7 re-audit.
3. [x] For exports that represent a meaningfully distinct usage pattern (not
       just a supporting type), add a short Patterns entry with a working code
       sample — judgment call per package, to be scoped during /analyze-ddd.
       Applied via D-4 heuristic; strengthened mid-task with a binding COMBO
       REQUIREMENT (human feedback after batch 1) so every unit adds at least
       one example combining 2+ symbols, not isolated snippets.
4. [x] Priority order for the pass (worst-covered first): `testing`,
       `contracts`, `policies`, `nestjs`, `di`, `validation` — these six account
       for the bulk of the 300+ gap. All six done, plus 4 more discovered
       mid-analysis (`acl`, `aggregates`, `cqrs`, `domain-services`, OQ-1) and
       `enterprise`.
5. [x] `nestjs`: `VytchesDDDFeatureModule`, `ContextAwareEventDispatcher`,
       `GLOBAL_QUERY_BUS`/`GLOBAL_COMMAND_BUS`/`LOCAL_EVENT_BUS`, and the
       `OutboxProcessorModule`/`OutboxProcessorService` subsystem specifically
       need coverage — these are central to how `forFeature()` cross-context
       wiring actually works. Batch 2; includes a combined `forFeature()`-based
       example using all three bus tokens together.
6. [x] Decide and document scope for `enterprise`: given it's an intentionally
       curating meta-package, determine whether closing gaps in the six packages
       it re-exports from is sufficient, or whether `enterprise/LLMGUIDE.md`
       itself needs additional pointers. Decision D-5: cross-reference table to
       each re-exported package's own LLMGUIDE.md + dedicated naming-conflict
       resolution section (9 real conflicts documented), not full row parity.
7. [x] Spot-check: re-run the same audit methodology (grep every exported symbol
       name against its LLMGUIDE.md) after the pass to confirm the gap actually
       closed, not just that content was added. Done — 11 parallel Explore
       agents, zero zero-mention symbols found across all touched packages.

## Out of scope

- Building test-verified example projects under `examples/` for newly documented
  symbols — that's VD-006 (coverage matrix + verification mechanism), a separate
  task with a different acceptance bar.
- Turning any of the newly documented Anti-Patterns into enforceable `ddd-lint`
  rules — that's VF-026.
- README.md content (as opposed to LLMGUIDE.md) — see VD-005 (docs-truth
  cleanup) for that surface.

## References

- Memory: `project_examples_coverage_audit` (round 2 — full per-package gap
  counts, worst-offender list, the `di` stale-docs bug, the
  `VytchesDDDFeatureModule` finding)
- Delivered artifact (2026-07-03): full per-package table with exact symbol
  names, kinds, and source file paths for every gap found in this audit —
  available in the session transcript, not duplicated here in full.
- Audit methodology: read each package's `src/index.ts` barrel in full,
  enumerate every exported symbol, grep the exact name against `LLMGUIDE.md`;
  for zero-hit symbols, read the source (JSDoc/signature) for an accurate
  description.
