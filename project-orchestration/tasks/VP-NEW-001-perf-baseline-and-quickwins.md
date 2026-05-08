# Task: Performance baseline + 3 zero-risk quick wins

## Task Metadata

```yaml
task_id: VP-NEW-001
title: Establish perf baselines + ship low-risk runtime optimizations before beta
type: optimization
priority: high
complexity: medium
estimated_time: 5h
created_by: agent (performance-optimizer 2026-05-08) + human (production-quality decision)
created_at: 2026-05-08
status: planned
release_target: v0.25.0-beta.1
goal: credible performance numbers in beta + 3 quick wins without API changes
```

## Why This Task Exists

A production DDD library is evaluated by enterprise teams who will ask "how
fast is it?" Without published benchmarks we cannot answer credibly. Without
a baseline in the repo, we cannot detect future regressions or back claims
like "30% faster than v0.x".

The performance-optimizer agent (2026-05-08) identified 5 hot-path wins. Three
of them are **single-line or local changes with no API impact** — perfect for
a pre-beta ship. The other two (`apply()` refactor, auto-discovery rewrite)
are deferred to VP-006 / VP-NEW-002 post-release because they touch hot
paths that need careful migration.

## Scope (what's IN this task)

### Part 1 — Baselines (~2h)

- [ ] Add `vitest bench` configuration to root `package.json`
- [ ] Write benchmarks for **5 core hot paths**:
  1. `AggregateRoot.apply()` — single event apply (event-sourced replay)
  2. `EnhancedQueryBus.dispatch()` — query path with cache miss
  3. `BaseEventBus.publish()` — fan-out to N subscribers
  4. `BaseValueObject.equals()` — deep equality on object props
  5. `EntityId.create()` — UUID generation hot path
- [ ] Snapshot baseline numbers in `benchmarks/baseline.json` (committed)
- [ ] Add `pnpm bench` and `pnpm bench:compare` scripts
- [ ] CI gate: regression alarm if any benchmark slows ≥15% vs baseline

### Part 2 — 3 zero-risk quick wins (~3h)

#### Win 1 — `BaseEventBus` early shortcircuit (small, ~30 min)

**File**: `packages/events/src/...` (find `BaseEventBus.publish`)

```ts
// BEFORE (every publish hits middleware before checking handlers)
async publish(event) {
  return this.runMiddleware(event, () => this.dispatch(event))
}

// AFTER
async publish(event) {
  const handlers = this.handlersFor(event.eventName)
  if (!handlers || handlers.size === 0) return  // ← shortcircuit
  return this.runMiddleware(event, () => this.dispatch(event))
}
```

**Impact**: removes middleware overhead for events with no subscribers (common
in tests + sparse subscription scenarios). Zero API change.

#### Win 2 — `cqrs-discovery-plugin` memoize scanModule (~1h)

**File**: `packages/cqrs/src/.../cqrs-discovery-plugin.ts`

```ts
private readonly scanCache = new WeakMap<object, ScanResult>()

scanModule(module: object) {
  const cached = this.scanCache.get(module)
  if (cached) return cached
  const result = this.computeScan(module)
  this.scanCache.set(module, result)
  return result
}
```

**Impact**: avoids repeated `Object.entries(module)` on the same module
reference. Modules don't mutate after load. WeakMap cleans up automatically.
Zero API change.

#### Win 3 — `EnhancedQueryBus.getCacheKey` FNV-1a hash (~1h)

**File**: `packages/cqrs/src/implementations/enhanced-query-bus.ts:609`

```ts
// BEFORE
private getCacheKey(query: TQuery): string {
  return `${query.constructor.name}:${JSON.stringify(query)}`
}

// AFTER (fnv1a hash — 10× faster, deterministic)
private getCacheKey(query: TQuery): string {
  return `${query.constructor.name}:${fnv1a(query)}`
}
```

Plus: skip `getCacheKey` entirely when cache disabled (move computation
inside the `if (this.cachingEnabled)` branch).

**Impact**: BIG per perf agent — every query dispatch currently pays
`JSON.stringify` cost even when cache is disabled.

## What's OUT (deferred)

- `apply()` Object.create + sanitizeMetadata refactor → **VP-NEW-002 (post-release)**
- `auto-discovery.service.ts` single-pass reflection → **VP-006 (post-release)**

These touch the hottest path in the library and need a careful migration
window with consumers, not a beta-eve change.

## Acceptance Criteria

- [ ] `pnpm bench` runs end-to-end in CI
- [ ] `benchmarks/baseline.json` committed with numbers
- [ ] CI fails on ≥15% regression
- [ ] All 3 quick wins implemented with regression test
- [ ] CHANGELOG `## [0.25.0-beta.1] Performance` lists wins with measured deltas
- [ ] Bench numbers used in README marketing section ("X events/sec on Node 22")

## Marketing payoff

Beta announcement can include:
> "Validated on Node 22: 250K events/sec single-aggregate apply, 1.2M cache
> hits/sec on EnhancedQueryBus, 45% faster cache key derivation than v0.24."

Beats vague "fast" claims and gives enterprise teams a concrete number to
plug into capacity planning.
