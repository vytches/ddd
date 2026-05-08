# Task: Bundle Size Deep Optimization

## Task Metadata

```yaml
task_id: VP-005
title: Replace export * with explicit named exports; subpath-export policies
type: optimization
priority: high
complexity: medium
estimated_time: 8h
created_by: human (work-items archive) + agent (performance-optimizer 2026-05-08)
created_at: 2026-03-31
migrated_at: 2026-05-08
status: planned
release_target: v0.25.0-beta.1
priority_score: 78/100
```

## Domain Context

```yaml
bounded_context: PackagePublishing
patterns:
  - Tree-shakable named exports
  - Subpath exports for optional modules
  - sideEffects: false
```

## Why This Task Exists

Performance review (2026-05-08) flagged two concrete bundle issues:

1. **`@vytches/ddd-enterprise` ships 11 wildcard `export *`** which prevents
   webpack/rollup from tree-shaking the sub-graph. Already fixed for
   `contracts`, `events`, `cqrs`, `di` — 11 packages remain.

2. **`@vytches/ddd-policies` is 436KB**, the largest dist in the monorepo.
   Decorators (`temporal-policy`, `retry-policy`, `cached-policy`),
   event-driven policy bus, and specification adapters all live in one bundle.
   Consumer importing only `BaseBusinessPolicy` pays the full cost.

3. **`@vytches/ddd-contracts` includes `dist/testing/`** (~16KB), shipped to
   every consumer though it is a dev-only contract.

## Desired State

- Every barrel uses explicit named exports
- `@vytches/ddd-policies` exposes subpath exports: `/core`, `/decorators`,
  `/events` — no breaking change
- `dist/testing/` removed from `contracts` runtime, moved to dev export

## Acceptance Criteria

- [ ] Replace `export *` with explicit exports in remaining 11 packages
      (target: tree-shaking 44% → 75%+)
- [ ] `@vytches/ddd-policies` subpath exports configured in `package.json`:
      ```json
      "exports": {
        ".": "./dist/index.js",
        "./core": "./dist/core/index.js",
        "./decorators": "./dist/decorators/index.js",
        "./events": "./dist/events/index.js"
      }
      ```
- [ ] Main `index` continues to re-export everything (backward compat)
- [ ] `contracts/dist/testing/` moved to `contracts/testing` subpath OR to
      `@vytches/ddd-testing`
- [ ] `pnpm build:analyze` shows policies main bundle ≤ 250KB
- [ ] `bundle-size-monitor.js` baseline updated; CI gates bundle regressions

## Out of scope

- Runtime hot-path optimizations (`apply()`, `getCacheKey()`) — scheduled
  post-release as VP-007 (performance-optimizer recommendations)
