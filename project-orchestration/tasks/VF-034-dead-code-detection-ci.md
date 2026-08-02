# Task: Dead-code detection (knip/ts-prune) — informational CI check

## Task Metadata

```yaml
task_id: VF-034
title:
  'Wire knip or ts-prune into CI as an informational check — dead/duplicate
  parallel implementations (VB-003 auto-discovery.service.ts class of bug)'
type: feature
priority: normal
complexity: simple
estimated_time: 4h
created_by: 'analyze-ddd panel (VF-026 OQ-1, 2026-07-10)'
created_at: 2026-07-10
status: backlog
release_target: post-first-publish OK
package: tooling (repo-root CI)
findings: []
```

## Why

Spun off from VF-026's `/analyze-ddd` pass (see
`project-orchestration/analysis/VF-026-ddd-lint-anti-pattern-rules.analysis.md`,
OQ-1 answered (a)). VB-003's actual lesson — `auto-discovery.service.ts` was a
dead, non-functional parallel implementation (`discover()` hardcoded to return
`[]`) duplicating `VytchesExplorerService`'s real responsibility, undetected
until a human noticed during an unrelated refactor — is a **dead/duplicate
code** problem, not a local AST anti-pattern. `tools/ddd-lint`'s single-file
syntactic-rule mechanism (`ddd-001..003/005`) cannot express "does this
class/method duplicate a responsibility another class already owns" — that needs
cross-file reachability analysis, which is exactly what `knip` or `ts-prune` are
built for. This is a different tool for a different job, not a `ddd-lint` rule.

## Acceptance Criteria

1. [ ] Evaluate `knip` vs `ts-prune` for this Nx/pnpm monorepo (19 packages) —
       `knip` is generally the more actively maintained, monorepo-aware choice
       (workspace-aware config, detects unused exports/dependencies/ files in
       one pass); confirm it handles this repo's package boundaries correctly
       (no false positives from cross-package `@vytches/ddd-*` barrel
       re-exports) before committing to it over `ts-prune`.
2. [ ] Add a config (`knip.json` or equivalent) scoped to flag: unused exported
       files/classes, unreachable code paths, and — if the chosen tool supports
       it — near-duplicate module detection. Tune to avoid false positives on
       intentionally-exported-but-currently-unused public API surface (a
       library's public API is allowed to have zero internal consumers; only
       flag files that are BOTH unexported from any package barrel AND
       unreferenced anywhere).
3. [ ] Wire into `.github/workflows/ci.yml` as **informational only**
       (`|| true`), same rollout posture as `ddd:lint` (VF-026 AC6) — do not
       block PRs on day one.
4. [ ] Baseline run against current `packages/`: record the initial finding
       count in this task file's Activity section (expect it to surface real
       candidates — VF-031's "zero-consumer scaffolding" audit already
       independently identified several dead/unused subsystems by hand, e.g.
       events `audit/`/`integration/`, `ACLDiscoveryPlugin`, ghost nestjs
       `types/index.ts` — cross-check the tool's findings against that list as a
       sanity check that it actually catches known dead code).
5. [ ] Document the check in `CONTRIBUTING.md` or the repo's tooling docs: what
       it catches, why it's informational (not blocking) initially, and the same
       Stage 1→2→3 rollout language `tools/ddd-lint/README.md` uses.

## Out of scope

- Making the check blocking — informational only for this task; a future task
  can propose a blocking date once the baseline finding count is low and stable
  (mirrors VF-026's `ddd:lint` rollout plan).
- Fixing any dead code the tool surfaces — that's VF-031's scope (or follow-up
  tasks per finding), not this task's.
- A new `ddd-lint` rule — explicitly descoped in favor of a purpose-built tool;
  do not revisit that decision here without a new `/analyze-ddd` pass.

## References

- Analysis:
  `project-orchestration/analysis/VF-026-ddd-lint-anti-pattern-rules.analysis.md`
  (OQ-1, decision (a))
- VF-026 (ddd-lint isDomainFile fix + ddd-005) — sibling task, same
  tooling-hygiene theme, different mechanism.
- VF-031 (pre-publish API surface diet) — independent, human-driven
  zero-consumer audit; cross-reference for baseline sanity-check (AC4).
