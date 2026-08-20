# Task: PolicyCache — concurrent identical checks are not deduplicated (cache stampede)

## Task Metadata

```yaml
task_id: VB-007
title: Deduplicate concurrent identical policy checks (cache stampede)
type: enhancement
priority: medium
complexity: medium
estimated_time: 3-5h
created_by: agent (analysis VB-006-policy-cache-v2, decision D9 / Q3)
created_at: 2026-08-20
status: backlog
release_target: post-first-publish OK
package: '@vytches/ddd-policies'
findings: [F12_poboczne]
```

## Dlaczego

`PolicyCachingBehavior.check()` has no in-flight deduplication: two concurrent
misses for the same cache key both invoke the inner policy and both write the
result. The cache absorbs repeated cost only _after_ the first call completes,
so a burst of simultaneous requests pays full price N times.

This hurts most in `forExpensivePolicy()` — the factory that exists specifically
to shield callers from repeated expensive evaluation, and therefore the one
whose callers are most likely to fan out concurrently.

Deliberately kept out of VB-006 (decision D9): that task is a focused bugfix on
the write path, this is a new capability with its own design questions.

## Acceptance Criteria

1. [ ] Concurrent `check()` calls resolving to the same cache key invoke the
       inner policy exactly once; all callers receive the same result.
2. [ ] An in-flight entry that rejects/fails does not poison subsequent calls —
       the pending promise is cleared, and the next call re-evaluates (or caches
       the failure, per `cacheFailures`).
3. [ ] No new public API surface unless explicitly justified; the deduplication
       is an internal property of the behaviour, not a new consumer-facing knob.
4. [ ] No timers, no background tasks — the library has no lifecycle/dispose
       hook (see VB-006 decision D5 and fact F10); an in-flight map keyed by
       cache key must be cleaned up on settle, not on a schedule.
5. [ ] Test proving the stampede: N concurrent identical checks against a policy
       that counts invocations asserts `callCount === 1`.
6. [ ] Interaction with `maxSize`/LRU eviction is defined and tested — an
       in-flight key must not be evictable in a way that leaks the pending
       entry.

## Open questions

- Should deduplication apply to all cached policies or only when opted into?
  Default-on is simpler and matches the caching contract; default-off is safer
  for policies whose evaluation has side effects.
- What happens to a caller that arrives while an in-flight evaluation is already
  past its TTL? Join the in-flight one, or start fresh?

## References

- `project-orchestration/analysis/VB-006-policy-cache-v2.analysis.md`
  (F12_poboczne, D9, Q3)
