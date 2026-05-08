# Task: StackBlitz playground + "Open in StackBlitz" badge

## Task Metadata

```yaml
task_id: DX-NEW-001
title: One-click runnable @vytches/ddd quickstart on StackBlitz
type: feature
priority: high
complexity: simple
estimated_time: 4h
created_by: agent (developer-experience 2026-05-08)
created_at: 2026-05-08
status: planned
release_target: v0.25.0-beta.1
```

## Why This Task Exists

DX audit ranked StackBlitz playground as the #1 killer feature: "first
interaction with library forces clone or copy-paste, no single-click playground
means developer evaluates by reading README rather than running code."

This is the highest conversion-impact / lowest-effort item in the entire
roadmap.

## Acceptance Criteria

- [ ] Public StackBlitz workspace pinned to `examples/quickstart/` content
- [ ] All 16 quickstart tests pass in StackBlitz environment
- [ ] "Open in StackBlitz" badge in top of README (above the fold)
- [ ] Workspace reads `@vytches/ddd@latest` (pulls from npm after publish)
- [ ] StackBlitz workspace URL documented in README + QUICK_START.md

## Notes

Coordinate with REL-006 (README rewrite) — badge belongs in the new compact
README, in the first 30 lines next to the install instruction.
