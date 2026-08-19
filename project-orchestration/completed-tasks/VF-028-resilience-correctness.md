# Task: Resilience correctness — jitter wiring, per-instance decorator state, HALF_OPEN probe gate

## Task Metadata

```yaml
task_id: VF-028
title:
  'resilience/cqrs/policies: hardcoded jitter:false in buses, per-class
  decorator policy state, unbounded HALF_OPEN probes, silent exception-to-false
  in specification adapter'
type: bug
priority: high
complexity: medium
estimated_time: 8h
created_by: SEC-AUDIT-2026-07-09
created_at: 2026-07-09
status: done
release_target:
  post-first-publish OK, except AC1 (default-behavior fix) preferred pre-publish
package:
  "'@vytches/ddd-resilience', '@vytches/ddd-cqrs', '@vytches/ddd-policies'"
findings: [SA-H3, SA-M2, SA-M3, SA-M4, SA-L5]
```

## Why

Four behavioral defects that surface only under production failure conditions —
exactly when a resilience package must not make things worse:

1. **SA-H3 (HIGH):** both CQRS buses hardcode `jitter: false` when wiring
   `RetryStrategy` (`enhanced-command-bus.ts:204`, `enhanced-query-bus.ts:309`),
   and neither bus's `resilience.retry` options expose a `jitter` field to
   override it. `RetryPolicy`'s own default is `jitter: true` — the safety net
   is bypassed at the one integration point that matters. When a shared
   downstream fails, every process retries in lockstep (1s/2s/4s…) — thundering
   herd re-crashing a recovering dependency.
2. **SA-M2 (MEDIUM-HIGH):** `@CircuitBreaker`/`@Bulkhead`/`@Retry`/
   `@Resilience` build their policy **once at decoration time**
   (`resilience-decorators.ts:51,143-167`) — breaker/bulkhead state is shared
   across ALL instances of the decorated class. Request-scoped providers or
   multiple clients pointing at different downstreams unintentionally share
   failure counters; one instance trips the breaker for all others.
3. **SA-M3 (MEDIUM):** circuit breaker HALF_OPEN has no probe-concurrency gate
   (`circuit-breaker.ts:108-113`; `execute()` admits everything) — the instant
   `recoveryTimeout` elapses, full traffic floods the recovering dependency
   instead of a single canary call, re-tripping immediately.
4. **SA-M4 (MEDIUM):** `BusinessRuleValidatorAdapter.isSatisfiedBy` converts any
   thrown exception to `false` with zero diagnostics
   (`specification-adapters.ts:32`) — a `TypeError` in a validator is
   indistinguishable from a legitimate business refusal in a business-critical
   gate. Its sibling `explainFailure` already propagates the error message, so
   the silence is a local inconsistency.
5. **SA-L5 (LOW, docs-only):** `RetryPolicy` retries all errors when no
   `retryableErrors` predicate is configured (`retry.ts:66-72`) —
   non-idempotency footgun for direct consumers.

## Acceptance Criteria

1. [x] `jitter` exposed in both buses' `resilience.retry` options, **default
       `true`** (aligning with `RetryPolicy`'s own default); hardcoded
       `jitter: false` removed. CHANGELOG note (retry delays become randomized —
       that is the fix, not a regression).
2. [x] Decorator policies are per-instance: policy created lazily per `this`
       (e.g. `WeakMap<instance, policy>` inside the decorator) so
       breaker/bulkhead state is not shared across instances. Document the new
       semantics in JSDoc + LLMGUIDE (including "if you WANT a shared breaker,
       share the instance or use an explicit named policy").
3. [x] HALF_OPEN gates probes: single in-flight probe by default (configurable
       `halfOpenMaxProbes` if trivially cheap); excess calls while probing are
       rejected as OPEN. Race-condition test: N concurrent calls at the recovery
       boundary → exactly the allowed probe count reaches the downstream.
4. [x] `isSatisfiedBy` no longer swallows silently: logs via
       `internalLogger.warn` (name + sanitized message) before returning
       `false`, OR rethrows non-domain errors — decide with the same
       fail-open-vs-fail-closed reasoning documented in the code, mirroring
       `explainFailure`'s behavior.
5. [x] SA-L5: JSDoc + LLMGUIDE warning on `RetryPolicy`/`@Retry` that the
       default retries ALL errors and `retryableErrors` should be set for
       non-idempotent work (no behavior change — the CQRS buses already made
       retry opt-in per REL-009).
6. [x] Regression: existing resilience test suites green; new tests for AC1-AC4
       (jitter present in computed delays, per-instance isolation, probe gate,
       adapter diagnostics).
7. [x] Escape hatch for AC2: `scope?: 'instance' | 'shared'` on
       `BaseResilienceDecoratorConfig`, default `'instance'`. Makes the JSDoc
       promise in AC2 ("if you WANT a shared breaker... use a named policy")
       actually true — without it, request-scoped providers lose
       breaker/bulkhead protection entirely instead of just having it fixed. Own
       contract tests, not folded into AC2's test suite. Decided 2026-08-19
       after consulting architecture-guardian, ddd-patterns-expert,
       library-expert and developer-experience (3:1 for building it now;
       library-expert's dissent — zero observed `@CircuitBreaker`/`@Bulkhead` +
       request-scoped usage in the repo today — is recorded in the analysis
       artifact's OQ1 answer).

## Out of scope

- `ResilienceContext` fork/dispose rewrite — VF-027 (attempt-context disposal in
  `RetryPolicy` is being added there, same file family).
- Resilience metrics wire-or-remove — VF-025.
- Backoff overflow guards (`maxDelay` already caps exponential growth in both
  wiring points — verified, no defect).

## References

- Analysis: `project-orchestration/analysis/SEC-AUDIT-2026-07-09.analysis.md`
  (SA-H3, SA-M2, SA-M3, SA-M4, SA-L5)
- REL-009 (retry opt-in in CQRS buses) — the precedent this task completes:
  retry that IS enabled must also be safe (jitter) and observable.

## Activity / Notes

- 2026-08-19: Implemented and shipped in one commit on
  `fix/VF-028-resilience-correctness`: `05ac364a` (jitter default, per-instance
  decorator state via `WeakMap`, `scope?: 'instance' | 'shared'` escape hatch,
  HALF_OPEN probe gate with `CircuitBreakerHalfOpenLimitError`, `isSatisfiedBy`
  warn-before-false, SA-L5 JSDoc/LLMGUIDE notes, new `BusRetryOptions` type
  unifying both buses' retry shape). Changeset
  (`.changeset/vf-028-resilience-correctness.md`), CHANGELOGs and LLMGUIDEs
  updated for `resilience`/`cqrs`/`policies`; enterprise barrel + api-report
  regenerated. Verified: `@vytches/ddd-resilience` 104/104 and
  `@vytches/ddd-policies` 237/237 tests green post-merge. `@vytches/ddd-cqrs`
  had 3 pre-existing failures in `enhanced-bus.test.ts`
  (`Reflect.getMetadata is not a function`) — confirmed via `git blame`
  unrelated to this change (`isIdempotent`, authored 2025-08-23, untouched by
  this commit; `reflect-metadata` is a declared peer dependency this package
  deliberately does not import, per its own README — an ad-hoc single-package
  test invocation without the app-level polyfill import). Task file's
  `status`/AC checkboxes were left at `backlog`/unchecked after the commit —
  metadata drift caught and corrected by `/pulse` + a direct user check ("czy
  028 właśnie nie skończyliśmy?"), not by the implementing session itself
  updating its own task file.
