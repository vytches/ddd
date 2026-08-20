# Task: ResilienceContext fork() — native AbortSignal.any()/AbortSignal.timeout() rewrite

## Task Metadata

```yaml
task_id: VF-027
title:
  Replace manual setTimeout+addEventListener disposal in fork()/withAttempt()
  with native AbortSignal.any()/AbortSignal.timeout()
type: refactor
priority: normal
complexity: simple
estimated_time: 1h
created_by:
  'VB-004 analysis panel (OQ-3), confirmed by
  architecture-guardian/library-api-guardian/library-expert consultation'
created_at: 2026-07-03
status: done
completed_at: 2026-08-20
release_target:
  post-first-public-publish (opportunistic — internal-only change, does not gate
  publish)
package: '@vytches/ddd-resilience'
findings: [SA-M12, UX-C6]
estimated_time_note: 'bumped 1h→2h on 2026-07-10 (UX-C6 added scope)'
```

## Why

VB-004 (outbox atomic claim + timer leaks) fixed `resilience-context.ts`'s
`fork()`/`withAttempt()` timer and parent-abort-listener leaks with an **interim
manual fix** (decision D-4: capture the timer, `clearTimeout` +
`removeEventListener` on settle, exposed via an optional `dispose?()` member on
`ResilienceContext`). The VB-004 analysis panel identified this as a stopgap,
not the proper long-term fix.

This library's `engines.node` is confirmed `>=22.19.0` (verified during VB-004
analysis), which makes two native APIs available:

- `AbortSignal.timeout(ms)` — returns a signal backed by an **already-unref'd,
  self-cleaning** timer.
- `AbortSignal.any([...])` — composes multiple signals (e.g. parent + timeout)
  into one, with internal listener cleanup handled by the platform.

Together these eliminate the manual `setTimeout`, the manual `clearTimeout`, the
manual `addEventListener('abort', ...)`/`removeEventListener` pairing, and the
`unref()` question — all in one stroke, with no public signature change (the
public surface still deals in `AbortSignal`).

**SA-M12 (SEC-AUDIT-2026-07-09) — added scope:** `RetryPolicy.execute()`
(`packages/resilience/src/patterns/retry.ts:39-58`) creates an `attemptContext`
per attempt via `DefaultResilienceContext.withAttempt()` — which registers a
parent-abort listener — but never calls `attemptContext.dispose?.()`, unlike
`circuit-breaker.ts:70` and `resilience-strategy.ts:101` (both dispose in
`finally` per VB-004 D-4). When a `ResilienceContext` is reused across multiple
`execute()` calls (a supported pattern via `contextProvider`), abort listeners
accumulate unboundedly on the shared signal. This is exactly the class of leak
this task's native-AbortSignal rewrite eliminates — fixing it here avoids
patching the manual mechanism twice.

**UX-C6 (LIB-UX-AUDIT-2026-07-10) — added scope:** `bulkhead.ts` is a **third
site** of the identical leak class this task fixes, missed by the prior audits:
(a) `executeWithTimeout` (`packages/resilience/src/patterns/bulkhead.ts:86`)
forks `context.withTimeout(...)` exactly like circuit-breaker/timeout-strategy
but never calls `.dispose?.()` (no `dispose` string anywhere in the file); (b)
worse, `enqueue` (`bulkhead.ts:117-127`) adds a `{once:true}` abort listener per
queued task that is only removed by its own firing — when the queued task
completes **normally**, the listener stays; with a long-lived shared context
(the documented `contextProvider` pattern) listeners accumulate unboundedly
exactly under load, when queueing actually happens. `bulkhead.test.ts` has zero
dispose/listener/timer assertions.

**Why this was split out of VB-004 rather than done there:** `fork()` currently
returns a context wrapping a real `AbortController`, and
`withMetadata`/`withAttempt` share that controller directly
(`resilience-context.ts`, confirmed during VB-004 analysis). `AbortSignal.any()`
produces a `signal`, not a `controller` — so the controller-sharing code paths
need rework, not a drop-in swap. That made it too open-ended for VB-004's 6h
budget; it is well-scoped as its own small task instead.

## Acceptance Criteria

1. [x] `fork()`/`withAttempt()` in `resilience-context.ts` use
       `AbortSignal.timeout()` / `AbortSignal.any([...])` instead of the manual
       `setTimeout` + `addEventListener('abort', ...)` pairing introduced/fixed
       by VB-004's D-4.
2. [x] No public API signature change — `ResilienceContext.fork()`'s return type
       and all method signatures stay exactly as they are today (this is an
       internal-implementation swap, not an API redesign — confirmed low-risk
       since `ResilienceContext` has zero external implementers anywhere in this
       repo per VB-004's OQ-5 finding).
3. [x] Explicitly decide and document the fate of VB-004's `dispose?()` member:
       does it become a no-op once native disposal handles cleanup
       automatically, is it formally deprecated, or does it stay for a different
       reason? Record the decision (not just leave it ambiguous).
4. [x] VB-004's disposal tests (timer-count via `vi.getTimerCount()` + a
       separate listener-count assertion, per VB-004 decision D-5) still pass,
       or are updated to match the new mechanism's observable semantics if
       `dispose?()` becomes a no-op.
5. [x] Regression: existing
       `CircuitBreaker`/`TimeoutStrategy`/resilience-context test suites stay
       green.
6. [x] **SA-M12:** `RetryPolicy.execute()` attempt contexts no longer leak
       parent-abort listeners — either disposed explicitly per attempt (in
       `finally`, matching circuit-breaker/timeout) or made structurally
       unnecessary by the native `AbortSignal.any()` composition; test: listener
       count on a reused parent context is stable across N `execute()` calls.
7. [x] **UX-C6:** `bulkhead.ts` covered by the same mechanism —
       `executeWithTimeout` disposes (or natively composes) its forked timeout
       context, and `enqueue`'s abort listener is removed when a queued task
       settles normally; test: listener count on a reused context is stable
       across N bulkhead calls that hit the queue path.

## Out of scope

- Changing the public `dispose?()` interface signature itself (only its internal
  necessity/wiring may change per AC#3 — removal, if decided, is a separate
  follow-up with its own deprecation cycle).
- Any broader `@vytches/ddd-resilience` API redesign beyond this one internal
  mechanism swap.

## References

- Spawned from:
  `project-orchestration/analysis/VB-004-outbox-atomic-claim.analysis.md` (open
  question OQ-3, decision D-4 — the interim fix this task properly replaces).
- Analysis: `project-orchestration/analysis/SEC-AUDIT-2026-07-09.analysis.md`
  (SA-M12 — RetryPolicy attempt-context disposal gap, added 2026-07-09).
- Panel consultation (2026-07-03, architecture-guardian + library-api-guardian +
  library-expert): unanimous recommendation to create this task now rather than
  leave it as a prose recommendation buried in the analysis artifact (this
  project's own history — VB-002/VB-003 spawning VD-006/VD-007/VF-026 — shows
  that pattern reliably loses follow-up work otherwise).

## Outcome (2026-08-20)

All seven criteria met. `fork()` and `withAttempt()` now compose signals with
`AbortSignal.any()` (plus `AbortSignal.timeout()` when a timeout is given); the
manual `setTimeout` + `{ once: true }` listener pairing is gone.

**D1 — the guarantee inverted, and got stronger.** VB-004's disposal was a
promise that `dispose()` _releases_ two resources. There is now nothing to
release: the timeout is an internal, already-unref'd platform timer, and the
composite signal owns its subscription to its sources. Forgetting to call
`dispose()` can no longer leak anything — which is what made AC6 and AC7
collapse into the same fix rather than needing three separate `finally` blocks.

**D2 — `dispose?()` becomes a documented no-op, not a removal (AC3).** VB-004
added `context.dispose?.()` calls in `circuit-breaker.ts` and
`resilience-strategy.ts`; deleting the member would break them for no gain. Both
the interface member and the implementation are `@deprecated` with the reasoning
inline, and the empty body is deliberate.

**D3 — one observable change worth knowing.** A fork that times out now aborts
with a `DOMException` whose `name` is `'TimeoutError'`, not with this package's
`TimeoutError` class. Code branching on `reason.name` is unaffected; code doing
`reason instanceof TimeoutError` on a _fork reason_ is. Nothing in this repo
does — `TimeoutError` is thrown directly by `resilience-strategy.ts`, which is
untouched, and that is what the existing tests assert against. Pinned by a test
so it cannot change silently.

**AC7 needed a second fix the context rewrite did not cover.** `bulkhead.ts`'s
`enqueue()` registers its _own_ `{ once: true }` listener, independent of the
context machinery — so it leaked on exactly the same happy path. Queued tasks
now carry a `releaseAbortListener` that `processQueue()` calls when the task
leaves the queue. The new test asserts removals equal additions on a reused
context; before the fix, removals stayed at zero.

Gates (`--skip-nx-cache`): resilience 110/110 (was 104 — 5 VB-004 disposal tests
rewritten per AC4, 6 new leak tests added), tsc clean, lint clean, build clean;
full repo 2662 passed / 7 skipped / 11 todo.
