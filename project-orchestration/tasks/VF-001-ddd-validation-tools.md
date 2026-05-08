# Task: DDD Compliance Validation Tools

## Task Metadata

```yaml
task_id: VF-001
title: Automated DDD compliance validation (rule engine + scoring)
type: feature
priority: normal
complexity: expert
estimated_time: 24h
created_by: human (work-items archive 2026-03-31)
created_at: 2026-03-31
migrated_at: 2026-05-08
status: planned
release_target: post-v0.25 (v0.26 or v0.27)
priority_score: 82/100
```

## Why This Task Exists

Library lacks automated DDD compliance validation: no aggregate boundary
validation, no repository pattern compliance, no ubiquitous language
consistency check, no dependency flow validation, no event naming convention
validation, no compliance scoring system.

## Why Post-Release

24h is half the release runway. Better to ship v0.25 as a usable library, then
add validation tooling as a follow-up — consumers can adopt the library
without it.

## Original Objectives (preserved)

1. Compliance rule engine
2. Aggregate boundary validation
3. Repository pattern compliance checks
4. Ubiquitous language validator
5. Compliance scoring system
6. CI integration for architecture review automation

## Notes

Consider a smaller MVP for v0.26: a `pnpm ddd:lint` script that catches the top
3 violations (mutable state in aggregates, throwing in domain layer,
non-Result-returning factory methods).
