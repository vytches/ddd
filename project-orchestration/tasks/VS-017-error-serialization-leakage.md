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
status: backlog
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

1. [ ] `BaseError` (or `IDomainError`) gains a canonical `toJSON()`: includes
       `name`, `code`, `message`, `timestamp`; **excludes** `stack` and any raw
       model payloads; includes `data` only per an explicit, documented decision
       (recommended: include — but document that `data` is a serialization
       boundary and factories must not put full domain objects in it).
2. [ ] `TranslationError.sourceModel` no longer reaches JSON output:
       non-enumerable property (kept for programmatic access in a debugger /
       catch block) or excluded via the class's `toJSON()`. The error `message`
       must stay generic (no interpolated model dump).
3. [ ] `PolicyViolation.toJSON()` drops `stack` (or moves it behind an explicit
       opt-in like `toJSON({ includeStack: true })` — decide and document;
       default must be off).
4. [ ] Tests: `JSON.stringify` snapshot per error class in the hierarchy
       asserting (a) `message` present, (b) no `stack`, (c) no `sourceModel`;
       regression test with a synthetic PII-bearing model through
       `BaseModelTranslator` failure path.
5. [ ] BC assessment (library-api-guardian): `toJSON` addition changes
       serialized shape — quasi-breaking for consumers snapshotting today's
       (broken) output; ship pre-publish, note in CHANGELOG/MIGRATION.
6. [ ] LLMGUIDE/README of acl + domain-primitives updated: "errors are safe to
       JSON-serialize; do not embed domain objects in error `data`".

## Out of scope

- ES2022 `cause:` chaining adoption (SA-L3) — repo-wide rethrow style change;
  separate improvement task if prioritized (main production impact is
  `acl/src/base-translator.ts`, which this task already touches — adding `cause`
  there opportunistically is allowed but not required).
- Registry collision semantics and `ServiceLocator` reconfiguration (SA-H4,
  SA-M10, SA-L4) — pending `/analyze-ddd` design decision per the audit
  artifact.

## References

- Analysis: `project-orchestration/analysis/SEC-AUDIT-2026-07-09.analysis.md`
  (SA-C1, SA-H5, SA-H6)
- Related precedent: sanitizeMetadata / sanitizeIntegrationPayload hardening
  (REL-007) — same "library must be safe at the serialization boundary"
  principle applied to inbound data; this task applies it to outbound errors.
