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
status: backlog
release_target: pre-first-public-publish (recommended — see Why)
package: packages/*/LLMGUIDE.md
findings:
  [project_examples_coverage_audit memory, delivered artifact 2026-07-03]
```

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

1. [ ] `di`: fix the Key API table entries describing non-existent symbols
       (`IContainer` → `IDependencyContainer`, `Lifetime` → `ServiceLifetime`,
       `ContainerError` → `DIError`) — a correction, not an addition.
2. [ ] For each undocumented export identified in the audit, add at minimum a
       Key API table row with an accurate description sourced from the code
       (JSDoc/signature) — no fabricated behavior.
3. [ ] For exports that represent a meaningfully distinct usage pattern (not
       just a supporting type), add a short Patterns entry with a working code
       sample — judgment call per package, to be scoped during /analyze-ddd.
4. [ ] Priority order for the pass (worst-covered first): `testing`,
       `contracts`, `policies`, `nestjs`, `di`, `validation` — these six account
       for the bulk of the 300+ gap.
5. [ ] `nestjs`: `VytchesDDDFeatureModule`, `ContextAwareEventDispatcher`,
       `GLOBAL_QUERY_BUS`/`GLOBAL_COMMAND_BUS`/`LOCAL_EVENT_BUS`, and the
       `OutboxProcessorModule`/`OutboxProcessorService` subsystem specifically
       need coverage — these are central to how `forFeature()` cross-context
       wiring actually works.
6. [ ] Decide and document scope for `enterprise`: given it's an intentionally
       curating meta-package, determine whether closing gaps in the six packages
       it re-exports from is sufficient, or whether `enterprise/LLMGUIDE.md`
       itself needs additional pointers.
7. [ ] Spot-check: re-run the same audit methodology (grep every exported symbol
       name against its LLMGUIDE.md) after the pass to confirm the gap actually
       closed, not just that content was added.

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
