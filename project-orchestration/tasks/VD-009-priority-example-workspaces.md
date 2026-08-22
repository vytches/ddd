# Task: Priority example workspaces — repositories+UoW, outbox processor, CQRS+resilience

## Task Metadata

```yaml
task_id: VD-009
title:
  'examples: three tested example workspaces for the combos flagged missing in
  three consecutive audits (repositories + real UoW, outbox processor,
  resilience-wrapped CQRS handler)'
type: documentation
priority: low
complexity: medium
estimated_time: 10h
created_by: LIB-MATURITY-AUDIT-2026-08-08
created_at: 2026-08-09
status: backlog
release_target: post-first-publish OK
package:
  'examples/ (repo-level), exercises repositories/messaging/cqrs/resilience'
findings: [audit S3-12; VD-006 out-of-scope split; 2026-07-03 examples audit]
```

## Why

Example coverage is 4/19 packages (quickstart, policies, domain-services,
nestjs). The same named combinations have now been flagged missing in three
consecutive audits (2026-07-03, 2026-07-10, 2026-08-08) and were explicitly
declared out of scope by VD-006 ("to be split out once the mechanism here is
settled" — the mechanism, VD-006a's matrix generator + CI check, has landed).
This is that split-out task, scoped to the three highest-value combos for a real
DDD+NestJS consumer.

## Acceptance Criteria

1. [ ] `examples/repositories-uow/`: aggregate + repository + a real
       (non-in-memory-toy) Unit of Work coordinating multi-aggregate commit/
       rollback, with a verifying test (follow `examples/policies/` pattern:
       numbered files + test).
2. [ ] `examples/outbox/`: domain event → `IOutboxRepository` implementation →
       outbox processor dispatch loop, including the failure/retry path, with a
       verifying test. Dependency-free (in-memory persistence is fine here — the
       point is the outbox _protocol_, not a DB driver; keep consistent with the
       no-adapters design constraint).
3. [ ] `examples/cqrs-resilience/`: command handler wrapped with retry + circuit
       breaker via bus `resilience` options, test proving both the happy path
       and breaker-open behavior. If VF-028 AC1 (jitter) has landed, the example
       uses/documents the new default; if not, it must not document the broken
       one.
4. [ ] All three registered in VD-006a's example matrix (manifest `level` field)
       so CI `--check` tracks them; all three green in the root test run like
       existing example workspaces.
5. [ ] Each example's README states which packages it exercises and links from
       the root README's examples section.

## Non-goals

- Covering all 19 packages (matrix mechanism tracks the remaining gaps).
- Framework adapter examples beyond what FRAMEWORK-ADAPTERS.md already documents
  as recipes.

## Links & References

- `project-orchestration/analysis/LIB-MATURITY-AUDIT-2026-08-08.analysis.md`
  (S3-12, action item 13).
- `project-orchestration/analysis/VD-006-example-coverage-matrix.analysis.md`
  (split decision; this is the promised follow-up).
- `examples/policies/` (structural pattern to follow).
