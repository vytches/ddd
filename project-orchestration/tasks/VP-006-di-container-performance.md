# Task: DI Container Performance Optimization

## Task Metadata

```yaml
task_id: VP-006
title: Cold-start, service-resolution, auto-discovery performance
type: optimization
priority: normal
complexity: complex
estimated_time: 16h
created_by: human (work-items archive 2026-03-31)
created_at: 2026-03-31
migrated_at: 2026-05-08
status: planned
release_target: post-v0.25
priority_score: 72/100
```

## Current Performance Issues (from work-item)

- Cold start: 2.5–4s for full container init
- First-time service resolution: 15–25ms
- Container metadata: 8–12MB for large apps
- Auto-discovery: 40% of startup time
- Multi-context resolution: +5–8ms

## Confirmed by 2026-05-08 performance audit

`packages/nestjs/src/discovery/auto-discovery.service.ts:98–148` — N×5
`Reflect.getMetadata()` calls per provider. With 200+ handlers in
`juz-ide-api`, that's measurable in cold start.

## Why Post-Release

Performance optimization with API stability dependency. Schedule as v0.26 work.

## Acceptance Criteria (preserved + amended)

1. Reduce cold start by 50% (target: 1–2s)
2. Service resolution &lt;5ms first-time
3. Single-pass reflection in auto-discovery (1 call per provider, not 5)
4. Memoize `scanModule` results in `cqrs-discovery-plugin.ts`
5. Container metadata ≤4MB for typical apps
