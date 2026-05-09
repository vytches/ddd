# Task: Break contracts → utils import — restore foundation purity

## Task Metadata

```yaml
task_id: REL-008
title: Move LibUtils/Result into contracts to restore acyclic dependency layers
type: refactor
priority: critical
complexity: simple
estimated_time: 2h
actual_time: 1.5h
created_by: agent (architecture-guardian)
created_at: 2026-05-08 14:00
revised_at: 2026-05-08 (user chose Option B after fact-checking the agent claim)
completed_at: 2026-05-08
status: completed
release_target: v0.25.0-beta.1
```

## ✅ Resolved (2026-05-08) — Option B chosen

Agent's original claim ("Result<T> sweep through 21 packages") proved overscoped
after grep confirmed **only 2 imports in 2 contracts files**:

1. `contracts/src/validation/validator.interfaces.ts:2` —
   `import type { Result }`
2. `contracts/src/events/domain-event-utils.ts:1` — `import { LibUtils }` for
   `getUUID()`

User decision: **Option B — move only `Result<T>` (semantic home), keep
`LibUtils` in utils (genuine utility), no 21-package sweep.**

### What was done

1. Copied `result.ts` → `contracts/src/shared/result.ts`
2. Exported via `contracts/src/shared/index.ts` and `contracts/src/index.ts`
3. Replaced `utils/src/result.ts` with re-export shim
   (`export { Result } from '@vytches/ddd-contracts'`)
4. Added `@vytches/ddd-contracts` to `utils/package.json` dependencies
5. Refactored `contracts/src/validation/validator.interfaces.ts` to use relative
   import (`../shared/result`)
6. Refactored `contracts/src/events/domain-event-utils.ts` to use
   `globalThis.crypto.randomUUID()` (Node 19+ universal API), removing
   `LibUtils` dependency. Tried `node:crypto` first but Vite externalization
   broke the bundle.
7. Removed `@vytches/ddd-utils` from `contracts/package.json` dependencies —
   **contracts is now truly dependency-free foundation**
8. Added smoke test in `contracts/tests/shared/result.spec.ts` (full Result
   behavior coverage stays in `utils/tests/result.spec.ts` working against
   re-exported Result)

### Verification

- `pnpm type-check` — 20 projects clean
- `pnpm test:ci` — 21 projects, all 215+ tests passing
- `pnpm deps:circular` — no circular dependencies
- `contracts/package.json` `dependencies` field removed entirely
- `pnpm -F @vytches/ddd-contracts build` — clean
- `pnpm -F @vytches/ddd-utils build` — clean (uses contracts as workspace dep)

### Out-of-scope finding (pre-existing, not introduced)

`Result` class identity differs between contracts/dist and utils/dist bundles
(`contracts.Result === utils.Result` returns `false`). This is the existing
pattern across the monorepo (e.g. `EntityId` from contracts vs value-objects
also has different class identity). Vite bundles workspace deps into each
package's own `dist`. Consumers should use `.isSuccess`/`.isFailure` (stable
public API) instead of `instanceof Result` checks — `instanceof` was never
guaranteed to work cross-package.

## Why This Task Exists

The architecture document declares `@vytches/ddd-contracts` as the **foundation
layer with no dependencies** — every other package builds on top of it. In
reality, contracts imports from `@vytches/ddd-utils`, inverting the layering.

Two leak sites identified:

- `packages/contracts/src/events/domain-event-utils.ts` — imports from
  `ddd-utils`
- `packages/contracts/src/validation/validator.interfaces.ts` — imports from
  `ddd-utils`

Consumers depending on `contracts` transitively pull `utils`, defeating the
"foundation breaker" promise.

## Acceptance Criteria

- [ ] `LibUtils` (or relevant subset) inlined into `contracts` OR moved to a new
      `@vytches/ddd-foundation` package below contracts
- [ ] `Result<T>` lives in `contracts` (most idiomatic location)
- [ ] `packages/contracts/package.json` lists zero workspace dependencies
- [ ] `pnpm deps:circular` and `pnpm deps:check` pass
- [ ] No regression in `utils` consumers (utils now depends on contracts, not
      vice versa)

## Risk

This is a structural move that touches every package. Schedule before REL-005
(public API cleanup), so the corrected import paths propagate to barrels in a
single sweep.
