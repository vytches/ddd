# Task: Re-enable the disabled domain-services e2e suite

## Task Metadata

```yaml
task_id: VT-007
title:
  'domain-services: resolve the "missing container classes" gap and re-enable
  the skipped e2e suite (6 describe/it.skip + 1 it.todo)'
type: test
priority: normal
complexity: medium
estimated_time: 5h
created_by: LIB-MATURITY-AUDIT-2026-08-08
created_at: 2026-08-09
status: backlog
release_target: before first non-alpha tag preferred
package: "'@vytches/ddd-domain-services'"
findings: [audit S2-7 / verified-facts hotspot]
```

## Why

The only skipped-test hotspot in the entire monorepo (verified 2026-08-08):
`packages/domain-services/tests/domain-services.e2e.test.ts:692` disables the
whole e2e suite with `describe.skip`, annotated in-code as
`(DISABLED - missing container classes)`, plus one `it.todo` in
`tests/di-integration/domain-service-discovery.test.ts:84`. This is real
untested runtime surface — not a false-passing test, but functionality with no
e2e verification at all. Note VF-031 removed the write-only
`DIDomainServiceMetadataRegistry` from this package; the skipped tests may
predate that surface diet and reference removed/never-built classes.

## Acceptance Criteria

1. [ ] Investigate which "container classes" the suite expects: determine for
       each skipped block whether (a) the class should exist and is a real
       library gap, (b) the test targets surface removed by VF-031 and should be
       rewritten against the current API, or (c) the scenario is obsolete and
       the block should be deleted (with justification in the commit).
2. [ ] Every `describe.skip`/`it.skip`/`it.todo` in the package is resolved —
       re-enabled and passing, rewritten and passing, or deleted with rationale.
       Zero skipped tests remain in `packages/domain-services`.
3. [ ] If (a) applies anywhere (missing library functionality), a scoped
       follow-up task is filed instead of growing this one — this task's job is
       truthful test coverage, not new features.
4. [ ] Full package suite + type-check green; no other package's tests touched.

## Links & References

- `project-orchestration/analysis/LIB-MATURITY-AUDIT-2026-08-08.analysis.md`
  (verified facts + finding S2-7).
- Completed: VF-031 (surface diet that may have orphaned these tests).
