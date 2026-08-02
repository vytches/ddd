# Task: Error serialization — stop leaking domain models, stacks; fix JSON shape

## Task Metadata

```yaml
task_id: VS-017
title:
  'acl/domain-primitives/policies: TranslationError sourceModel leak,
  PolicyViolation stack in toJSON, missing toJSON in error hierarchy'
type: bug
priority: high
complexity: medium
estimated_time: 6h
created_by: SEC-AUDIT-2026-07-09
created_at: 2026-07-09
status: done
completed_at: 2026-07-10
release_target:
  pre-first-public-publish (serialization shape change — cheap only before
  publish)
package:
  "'@vytches/ddd-acl', '@vytches/ddd-domain-primitives', '@vytches/ddd-policies'"
findings: [SA-C1, SA-H5, SA-H6]
```

## Why

Three related defects make the library's errors leak data the moment a consumer
serializes them — which is the default behavior of JSON loggers (pino/winston)
and framework exception filters:

1. **SA-C1 (CRITICAL):** `TranslationError` stores the complete source
   domain/external model as a public **enumerable** field
   (`packages/acl/src/acl-errors.ts:54`), populated on every translation failure
   by `BaseModelTranslator` (`base-translator.ts:21-30,44-51`).
   `JSON.stringify(err)` serializes the full model. ACL translation failures
   fire precisely on cross-context schema drift — the error a consumer is most
   likely to log. Verified by reproduction: synthetic PII fields passed through
   intact.
2. **SA-H5 (HIGH):** `PolicyViolation.toJSON()` explicitly includes `stack`
   (`packages/policies/src/core/models/policy-violation.ts:131`) in a method
   documented as "Convert to plain object for serialization" — absolute server
   paths and internal call structure cross whatever boundary the violation is
   sent over.
3. **SA-H6 (HIGH):** no `toJSON()` exists anywhere in the
   `BaseError`/`IDomainError` hierarchy
   (`packages/domain-primitives/src/errors/`). `JSON.stringify` on any library
   error therefore drops `message` (non-enumerable inherited property) while
   keeping `data` (enumerable) — producing message-less error logs today, and
   guaranteeing that any future factory attaching richer `data` inherits a
   silent leak.

## Acceptance Criteria

1. [x] `IDomainError` gains a canonical `toJSON()`: whitelist of `name`, `code`,
       `message`, `timestamp`, `data` — deliberately excludes `stack` AND any
       subclass-added enumerable field not in the whitelist (e.g.
       `ACLError.contextName`/`operation` are dropped from JSON output unless a
       subclass explicitly overrides `toJSON()` to add them back — a stricter,
       safer default than the AC's own suggestion, documented as a trade-off in
       the method's own doc comment).
2. [x] `TranslationError.sourceModel` is now a non-enumerable property
       (`Object.defineProperty`, not a constructor parameter-property) — never
       reaches `JSON.stringify()` output, still accessible via
       `error.sourceModel` programmatically. `message` was already generic
       (verified — `base-translator.ts` never interpolates the model).
3. [x] `PolicyViolation.toJSON(options?: { includeStack?: boolean })` — stack
       omitted by default (including via plain `JSON.stringify()`, which calls
       `toJSON()` with no arguments); explicit `{ includeStack: true }` opts in.
       No internal call site relied on the old always-on behavior (verified via
       grep before changing).
4. [x] Tests added (11 new, all passing): `domain-error-flexibility.test.ts`
       (message/code/data present, no stack, whitelist proof via a synthetic
       subclass with an extra field); `acl-errors.test.ts` (no sourceModel in
       JSON even with PII fields, still accessible directly, message present);
       `base-translator.test.ts` (regression test through the real
       `BaseModelTranslator.toExternal()` failure path with a synthetic
       PII-bearing domain model); `policy-violation.test.ts` (stack absent by
       default, present with explicit opt-in).
5. [x] BC assessment (self-assessed directly, no separate agent spawned given
       session cost — same judgment call as VS-018's design note): this is a
       genuine shape change to `JSON.stringify(err)` output for every
       `IDomainError` subclass across the monorepo (aggregates, domain-services,
       projections, repositories, acl, domain-primitives — verified via grep,
       all confirmed to still pass their own test suites unmodified).
       Quasi-breaking for any consumer that was (accidentally) relying on
       today's broken shape (message-less, raw `data` dump) — intentional, ships
       pre-publish per the task's own release_target, CHANGELOG is
       Lerna-generated from the conventional commit (no manual edit per project
       convention).
6. [x] `packages/domain-primitives/LLMGUIDE.md` and `packages/acl/LLMGUIDE.md`
       Anti-Patterns sections updated: don't put raw models in `data`; don't
       assume `TranslationError` is unsafe to log (it now is safe).

## Out of scope

- ES2022 `cause:` chaining adoption (SA-L3) — repo-wide rethrow style change;
  separate improvement task if prioritized (main production impact is
  `acl/src/base-translator.ts`, which this task already touches — adding `cause`
  there opportunistically is allowed but not required).
- Registry collision semantics and `ServiceLocator` reconfiguration (SA-H4,
  SA-M10, SA-L4) — pending `/analyze-ddd` design decision per the audit
  artifact.

## Activity / Notes

### 2026-07-10 — implemented on `feature/VS-017-error-serialization-leakage`, merged to develop (status: done)

Verification before merge: `domain-primitives` test (24/24), type-check, lint (0
errors); `acl` test (273/273), type-check, lint (0 errors); `policies` test
(227/227), type-check, lint (0 errors). Blast-radius check (every class
extending `IDomainError`): `aggregates` (191/191), `domain-services` (42/42, 7
pre-existing skipped), `projections` (135/135), `repositories` (17/17),
`enterprise` api-surface smoke — all green, zero regressions. Hit one
`exactOptionalPropertyTypes: true` typecheck error on the first pass
(`toJSON()`'s inline return-type annotation needed
`timestamp?: Date | undefined`, not bare `Date`) — fixed immediately, not a
design issue.

## References

- Analysis: `project-orchestration/analysis/SEC-AUDIT-2026-07-09.analysis.md`
  (SA-C1, SA-H5, SA-H6)
- Related precedent: sanitizeMetadata / sanitizeIntegrationPayload hardening
  (REL-007) — same "library must be safe at the serialization boundary"
  principle applied to inbound data; this task applies it to outbound errors.
