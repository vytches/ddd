# Task: Event Store Streaming Performance

## Task Metadata

```yaml
task_id: VP-004
title: Streaming event projections with backpressure
type: optimization
priority: normal
complexity: complex
estimated_time: 18h
created_by: human (work-items archive 2026-03-31)
created_at: 2026-03-31
migrated_at: 2026-05-08
status: planned
release_target: post-v0.25
priority_score: 86/100
depends_on: VP-002 (Repository Performance)
```

## Why This Task Exists

Original work-item context (event store streaming) was based on assumption of
in-library event store. Library philosophy (memory note): **no event-store
adapter, library is dependency-free**. Reread original VP-004 work-item to
align scope with current architecture.

## Why Post-Release

Coupled with VP-002, post-stabilization optimization.

## Open question

Confirm with user: does this task still apply given the "no adapters" decision?
If event store is consumer-supplied, this task may be repurposed as
"Streaming patterns documentation" (how consumers should stream from their
own event store using `@vytches/ddd-projections`).
