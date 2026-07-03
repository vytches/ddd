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
status: backlog
release_target:
  post-first-public-publish (opportunistic — internal-only change, does not gate
  publish)
package: '@vytches/ddd-resilience'
findings: []
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

**Why this was split out of VB-004 rather than done there:** `fork()` currently
returns a context wrapping a real `AbortController`, and
`withMetadata`/`withAttempt` share that controller directly
(`resilience-context.ts`, confirmed during VB-004 analysis). `AbortSignal.any()`
produces a `signal`, not a `controller` — so the controller-sharing code paths
need rework, not a drop-in swap. That made it too open-ended for VB-004's 6h
budget; it is well-scoped as its own small task instead.

## Acceptance Criteria

1. [ ] `fork()`/`withAttempt()` in `resilience-context.ts` use
       `AbortSignal.timeout()` / `AbortSignal.any([...])` instead of the manual
       `setTimeout` + `addEventListener('abort', ...)` pairing introduced/fixed
       by VB-004's D-4.
2. [ ] No public API signature change — `ResilienceContext.fork()`'s return type
       and all method signatures stay exactly as they are today (this is an
       internal-implementation swap, not an API redesign — confirmed low-risk
       since `ResilienceContext` has zero external implementers anywhere in this
       repo per VB-004's OQ-5 finding).
3. [ ] Explicitly decide and document the fate of VB-004's `dispose?()` member:
       does it become a no-op once native disposal handles cleanup
       automatically, is it formally deprecated, or does it stay for a different
       reason? Record the decision (not just leave it ambiguous).
4. [ ] VB-004's disposal tests (timer-count via `vi.getTimerCount()` + a
       separate listener-count assertion, per VB-004 decision D-5) still pass,
       or are updated to match the new mechanism's observable semantics if
       `dispose?()` becomes a no-op.
5. [ ] Regression: existing
       `CircuitBreaker`/`TimeoutStrategy`/resilience-context test suites stay
       green.

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
- Panel consultation (2026-07-03, architecture-guardian + library-api-guardian +
  library-expert): unanimous recommendation to create this task now rather than
  leave it as a prose recommendation buried in the analysis artifact (this
  project's own history — VB-002/VB-003 spawning VD-006/VD-007/VF-026 — shows
  that pattern reliably loses follow-up work otherwise).
