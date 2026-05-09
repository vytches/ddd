# Task: Messaging Outbox Pattern Optimization

## Task Metadata

```yaml
task_id: VP-003
title: Batching, prioritization, binary serialization in outbox
type: optimization
priority: normal
complexity: complex
estimated_time: 14h
created_by: human (work-items archive 2026-03-31)
created_at: 2026-03-31
migrated_at: 2026-05-08
status: planned
release_target: post-v0.25
priority_score: 87/100
```

## Why This Task Exists

Outbox pattern bottlenecks:

- Sequential message processing
- Database polling inefficiency for high-volume scenarios
- No batching or prioritization
- Serialization/deserialization overhead
- No connection pooling for publishers

**Business Impact**: 50% improvement in message throughput.

## Why Post-Release

Performance optimization, post-API-stabilization. Coupled with messaging package
which has weak test coverage (testing-excellence: 7 src / 2 tests). Add tests
**before** optimization — see post-release coverage task.

## Acceptance Criteria (preserved)

1. +50% message throughput
2. -60% database polling overhead
3. Configurable batching
4. Message priority lanes
5. Binary serialization optimization
