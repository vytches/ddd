# Task: Break contracts → utils import — restore foundation purity

## Task Metadata

```yaml
task_id: REL-008
title: Move LibUtils/Result into contracts to restore acyclic dependency layers
type: refactor
priority: critical
complexity: complex
estimated_time: 7h
created_by: agent (architecture-guardian)
created_at: 2026-05-08 14:00
revised_at: 2026-05-08 (critical-reviewer: Result<T> move = sweep through 21 packages, not 4h)
status: planned
release_target: v0.25.0-beta.1
```

## Effort note

Original estimate (4h) only accounted for the contracts-side move. Reality:
`Result<T>` is consumed by virtually every package (`utils`, `aggregates`,
`cqrs`, `events`, `repositories`, `policies`, `validation`, ...). Moving the
canonical definition to `contracts` means updating import paths in **all 21
packages** + their tests.

Realistic breakdown:
- 2h: move LibUtils/Result source files into `contracts`
- 3h: update import paths across 21 packages + tests
- 1h: confirm `pnpm deps:circular` and `pnpm deps:check` clean
- 1h: backwards-compat shim in `utils` (re-export from contracts) so external
  consumers don't break

## Why This Task Exists

The architecture document declares `@vytches/ddd-contracts` as the **foundation
layer with no dependencies** — every other package builds on top of it. In
reality, contracts imports from `@vytches/ddd-utils`, inverting the layering.

Two leak sites identified:

- `packages/contracts/src/events/domain-event-utils.ts` — imports from `ddd-utils`
- `packages/contracts/src/validation/validator.interfaces.ts` — imports from
  `ddd-utils`

Consumers depending on `contracts` transitively pull `utils`, defeating the
"foundation breaker" promise.

## Acceptance Criteria

- [ ] `LibUtils` (or relevant subset) inlined into `contracts` OR moved to a
      new `@vytches/ddd-foundation` package below contracts
- [ ] `Result<T>` lives in `contracts` (most idiomatic location)
- [ ] `packages/contracts/package.json` lists zero workspace dependencies
- [ ] `pnpm deps:circular` and `pnpm deps:check` pass
- [ ] No regression in `utils` consumers (utils now depends on contracts, not
      vice versa)

## Risk

This is a structural move that touches every package. Schedule before REL-005
(public API cleanup), so the corrected import paths propagate to barrels in a
single sweep.
