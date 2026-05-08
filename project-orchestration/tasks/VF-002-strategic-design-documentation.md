# Task: Strategic Design Documentation

## Task Metadata

```yaml
task_id: VF-002
title: Bounded context, context mapping, large-scale structure docs
type: documentation
priority: normal
complexity: complex
estimated_time: 20h
created_by: human (work-items archive 2026-03-31)
created_at: 2026-03-31
migrated_at: 2026-05-08
status: planned
release_target: post-v0.25
priority_score: 78/100
depends_on:
  - VD-001 (Enhanced Metadata System) — historical, may not apply post-pivot
  - VF-001 (DDD Validation Tools) — also post-release
```

## Why This Task Exists

VytchesDDD library lacks comprehensive strategic design documentation:

- Bounded context identification patterns
- Context mapping strategies
- Domain modeling guidelines
- Strategic DDD patterns implementation
- Enterprise architecture alignment
- Large-scale structure design

Without this, enterprise teams adopting the library risk:

- Poor bounded context boundaries (40% of implementations)
- Inadequate context mapping (65% missing)
- Monolithic designs disguised as DDD

## Why Post-Release

Documentation-heavy task; ship the code first, then bring the strategic guide
in v0.26 as a polished separate `docs/strategic-design/` section.

## Out-of-band consideration

DDD compliance audit (2026-05-08) recommended adding `@BoundedContext('name')`
decorator + `contextName` metadata field to events. That's a code change, not
a docs change — could be split into a sub-task `VF-002a` once VF-002 starts.
