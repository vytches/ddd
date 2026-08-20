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
status: done
completed_at: 2026-08-20
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

1. [x] Concurrent `check()` calls resolving to the same cache key invoke the
       inner policy exactly once; all callers receive the same result.
2. [x] An in-flight entry that rejects/fails does not poison subsequent calls —
       the pending promise is cleared, and the next call re-evaluates (or caches
       the failure, per `cacheFailures`).
3. [x] No new public API surface unless explicitly justified; the deduplication
       is an internal property of the behaviour, not a new consumer-facing knob.
4. [x] No timers, no background tasks — the library has no lifecycle/dispose
       hook (see VB-006 decision D5 and fact F10); an in-flight map keyed by
       cache key must be cleaned up on settle, not on a schedule.
5. [x] Test proving the stampede: N concurrent identical checks against a policy
       that counts invocations asserts `callCount === 1`.
6. [x] Interaction with `maxSize`/LRU eviction is defined and tested — an
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

## Outcome (2026-08-20)

All six criteria met. `PolicyCachingBehavior` keeps an `inFlight` map keyed by
cache key; a caller whose key is already being evaluated awaits that promise
instead of starting a second evaluation. Entries clear on settle in a `finally`
— no timers, no sweep (AC4).

**Answers to the task's open questions**

**D1 — deduplication is on by default, with no new option.** AC3 asked for
justification before adding public surface, and there is none to add: the
caching contract already says a result may be served to a caller that never ran
the policy, so a second caller joining an in-flight evaluation is the same
promise the cache already makes, just earlier. A policy with side effects is
already incompatible with caching, opt-in or not.

**D2 — a caller arriving mid-flight past the TTL joins, rather than starting
fresh.** TTL bounds how long a _stored_ result stays usable. An evaluation that
started moments ago is fresher than anything the cache could return, so starting
a second one would pay full cost for a strictly worse answer.

**D3 — in-flight entries live outside the LRU (AC6).** They are not cached
values and must never be evictable; an eviction mid-flight would strand every
caller awaiting that promise. `maxSize` therefore bounds stored results only,
which is what it documents.

**Consequence worth recording: this closed VB-006 AC4's only public trigger.**
Those tests drove `PolicyCache.set()`'s re-write branch (D1-D3 there) through
the one path that reached it — two `check()` calls racing on an uncached key.
With deduplication, one key has at most one evaluation in flight, and `get()`
deletes a TTL-expired entry before the next `set()`, so **every `set()`
reachable from `check()` is now an insert**. The re-write branch is unreachable
from the public surface.

The defensive code in `PolicyCache.set()` stays — it is correct and cheap — but
the two tests asserting on it were asserting on a scenario that can no longer
occur, and were rewritten into proofs that the trigger is closed: N concurrent
identical checks invoke the inner policy exactly once; a failed evaluation
clears its entry so the next caller re-evaluates; distinct keys stay
independent.

Gates (`--skip-nx-cache`): policies 263/263, tsc clean, lint 0 errors, build
clean.
