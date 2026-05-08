# Task: Repository Query Performance Enhancement

## Task Metadata

```yaml
task_id: VP-002
title: Repository caching + indexed queries + N+1 prevention
type: optimization
priority: normal
complexity: complex
estimated_time: 20h
created_by: human (work-items archive 2026-03-31)
created_at: 2026-03-31
migrated_at: 2026-05-08
status: planned
release_target: post-v0.25
priority_score: 88/100
```

## Why This Task Exists

Repository performance bottlenecks:

- Aggregate loading with complex specifications
- N+1 query problems in related entity fetching
- No query result caching
- Inefficient specification evaluation
- No indexed query support

**Business Impact**: 35% faster aggregate loading.

## Why Post-Release

Performance optimization belongs after API stabilization. Refactoring
performance characteristics post-1.0 with semver-bound API would be much
harder than now — but the bottleneck risk is small for v0.25 beta consumers
(`juz-ide-api` is already running this code in production, performance is
"acceptable").

## Acceptance Criteria (preserved)

1. Reduce aggregate loading time by 35%
2. Eliminate N+1 query problems
3. Intelligent caching strategy
4. Indexed query support for common patterns
5. Specification-based query optimization
